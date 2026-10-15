import { nanoid } from "nanoid";
import { create } from "zustand";

import { callSendSession } from "@/lib/repositories/session";
import * as runtime from "../../../../wailsjs/runtime/runtime";


const EVENT_FRAME = "omp:frame";
const EVENT_EXIT = "omp:rpc-exit";

const COLLAPSED_KEY = "omp-panel-collapsed";

const MAX_AGENTS = 24;

const MAX_TASK_CHARS = 200;

export interface PanelAgent {
  id: string;
  agent: string;
  task: string;
  index: number;
  startedAt?: number;
}

interface PanelState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  agentsByKey: Record<string, PanelAgent[]>;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {
  }
}

export const usePanelStore = create<PanelState>()((set, get) => ({
  collapsed: readCollapsed(),
  setCollapsed: (collapsed) => {
    set({ collapsed });
    writeCollapsed(collapsed);
  },
  toggleCollapsed: () => {
    const collapsed = !get().collapsed;
    set({ collapsed });
    writeCollapsed(collapsed);
  },
  agentsByKey: {},
}));

const NO_AGENTS: PanelAgent[] = [];

export function usePanelAgents(key: string | null): PanelAgent[] {
  return usePanelStore((state) =>
    key ? (state.agentsByKey[key] ?? NO_AGENTS) : NO_AGENTS
  );
}

function setAgents(key: string, agents: PanelAgent[]): void {
  usePanelStore.setState((state) => {
    const agentsByKey = { ...state.agentsByKey };
    if (agents.length === 0) {
      delete agentsByKey[key];
    } else {
      agentsByKey[key] = agents;
    }
    return { agentsByKey };
  });
}

function compareAgents(a: PanelAgent, b: PanelAgent): number {
  return a.index - b.index || a.id.localeCompare(b.id);
}

function addAgent(key: string, agent: PanelAgent): void {
  const current = usePanelStore.getState().agentsByKey[key] ?? [];
  const existing = current.find((candidate) => candidate.id === agent.id);
  const merged: PanelAgent = {
    ...agent,
    agent: agent.agent || existing?.agent || "",
    task: agent.task || existing?.task || "",
    startedAt: existing?.startedAt ?? agent.startedAt ?? Date.now(),
  };
  const next = [
    ...current.filter((candidate) => candidate.id !== agent.id),
    merged,
  ]
    .sort(compareAgents)
    .slice(0, MAX_AGENTS);
  setAgents(key, next);
}

function removeAgent(key: string, id: string): void {
  const current = usePanelStore.getState().agentsByKey[key];
  if (!current || !current.some((candidate) => candidate.id === id)) {
    return;
  }
  setAgents(
    key,
    current.filter((candidate) => candidate.id !== id)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TASK_CHARS) : "";
}

function asIndex(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function commandName(command: unknown): string {
  if (typeof command === "string") {
    return command;
  }
  const record = asRecord(command);
  return record && typeof record.type === "string" ? record.type : "";
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "aborted"]);

function handleLifecycle(key: string, payload: Record<string, unknown>): void {
  const id = asText(payload.id);
  if (!id) {
    return;
  }
  if (payload.status !== "started") {
    removeAgent(key, id);
    return;
  }
  addAgent(key, {
    id,
    agent: asText(payload.agent),
    task: asText(payload.description),
    index: asIndex(payload.index),
  });
}

function handleProgress(key: string, payload: Record<string, unknown>): void {
  const progress = asRecord(payload.progress);
  if (!progress) {
    return;
  }
  const id = asText(progress.id);
  if (!id) {
    return;
  }
  const status = typeof progress.status === "string" ? progress.status : "";
  if (TERMINAL_STATUSES.has(status)) {
    removeAgent(key, id);
    return;
  }
  if (status !== "running") {
    return;
  }
  addAgent(key, {
    id,
    agent: asText(payload.agent) || asText(progress.agent),
    task:
      asText(payload.task) ||
      asText(payload.assignment) ||
      asText(progress.description),
    index: asIndex(payload.index),
  });
}

function handleSubagentSnapshot(key: string, data: Record<string, unknown>): void {
  const rows = Array.isArray(data.subagents) ? data.subagents : [];
  const agents: PanelAgent[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) {
      continue;
    }
    const id = asText(row.id);
    if (!id || row.status !== "running") {
      continue;
    }
    agents.push({
      id,
      agent: asText(row.agent),
      task:
        asText(row.task) || asText(row.assignment) || asText(row.description),
      index: asIndex(row.index),
    });
  }
  agents.sort(compareAgents);
  setAgents(key, agents.slice(0, MAX_AGENTS));
}

function handleFrame(key: string, payload: unknown): void {
  if (!key) {
    return;
  }
  const frame = asRecord(payload);
  if (!frame) {
    return;
  }
  switch (frame.type) {
    case "subagent_lifecycle": {
      const body = asRecord(frame.payload);
      if (body) {
        handleLifecycle(key, body);
      }
      break;
    }
    case "subagent_progress": {
      const body = asRecord(frame.payload);
      if (body) {
        handleProgress(key, body);
      }
      break;
    }
    case "response": {
      if (commandName(frame.command) !== "get_subagents" || frame.success === false) {
        break;
      }
      const data = asRecord(frame.data);
      if (data) {
        handleSubagentSnapshot(key, data);
      }
      break;
    }
    default:
      break;
  }
}

export async function enableAgentFrames(key: string): Promise<void> {
  await callSendSession(
    key,
    JSON.stringify({
      id: nanoid(),
      type: "set_subagent_subscription",
      level: "progress",
    })
  );
  await callSendSession(
    key,
    JSON.stringify({ id: nanoid(), type: "get_subagents" })
  );
}

try {
  runtime.EventsOn(EVENT_FRAME, (key: unknown, frame: unknown) => {
    handleFrame(typeof key === "string" ? key : "", frame);
  });
  runtime.EventsOn(EVENT_EXIT, (key: unknown) => {
    if (typeof key === "string" && key) {
      setAgents(key, []);
    }
  });
} catch {
}
