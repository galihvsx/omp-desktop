import { nanoid } from "nanoid";
import { create } from "zustand";

import { callStopAllTerminals, callTerminalStop } from "@/lib/repositories/terminal";
import * as runtime from "../../../../wailsjs/runtime/runtime";

const EVENT_DATA = "term:data";
const EVENT_EXIT = "term:exit";

const HEIGHT_KEY = "omp-terminal-height";

const MAX_PENDING = 200_000;
const pending = new Map<string, string>();

const writers = new Map<string, (chunk: string) => void>();

export const TERMINAL_MIN_DVH = 10;
export const TERMINAL_MAX_DVH = 50;
export const TERMINAL_DEFAULT_DVH = 30;

function readHeight(): number {
  try {
    const raw = window.localStorage.getItem(HEIGHT_KEY);
    const parsed = raw === null ? Number.NaN : Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return Math.min(TERMINAL_MAX_DVH, Math.max(TERMINAL_MIN_DVH, parsed));
    }
  } catch {
  }
  return TERMINAL_DEFAULT_DVH;
}

function writeHeight(height: number): void {
  try {
    window.localStorage.setItem(HEIGHT_KEY, String(height));
  } catch {
  }
}

function clampHeight(height: number): number {
  return Math.round(
    Math.min(TERMINAL_MAX_DVH, Math.max(TERMINAL_MIN_DVH, height))
  );
}

export interface TerminalTab {
  id: string;
  shellName: string;
  exited: string;
}

interface TerminalState {
  tabs: TerminalTab[];
  activeId: string | null;
  height: number;
  openTab: () => string;
  closeTab: (id: string) => void;
  closeAll: () => void;
  setActive: (id: string) => void;
  setHeight: (height: number) => void;
  setShellName: (id: string, name: string) => void;
  markExited: (id: string, detail: string) => void;
  clearExited: (id: string) => void;
  toggle: () => void;
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  tabs: [],
  activeId: null,
  height: readHeight(),

  openTab: () => {
    const id = nanoid();
    set((state) => ({
      tabs: [...state.tabs, { id, shellName: "", exited: "" }],
      activeId: id,
    }));
    return id;
  },

  closeTab: (id) => {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return;
    }
    const next = tabs.filter((tab) => tab.id !== id);
    const neighbour = next[index] ?? next[index - 1];
    set({
      tabs: next,
      activeId: activeId === id ? (neighbour?.id ?? null) : activeId,
    });
    writers.delete(id);
    pending.delete(id);
    void callTerminalStop(id).catch(() => {});
  },

  closeAll: () => {
    writers.clear();
    pending.clear();
    set({ tabs: [], activeId: null });
    void callStopAllTerminals().catch(() => {});
  },

  setActive: (id) => {
    if (get().tabs.some((tab) => tab.id === id)) {
      set({ activeId: id });
    }
  },

  setHeight: (height) => {
    const next = clampHeight(height);
    set({ height: next });
    writeHeight(next);
  },

  setShellName: (id, name) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1 || state.tabs[index].shellName === name) {
        return state;
      }
      const tabs = [...state.tabs];
      tabs[index] = { ...tabs[index], shellName: name };
      return { tabs };
    });
  },

  markExited: (id, detail) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1 || state.tabs[index].exited === detail) {
        return state;
      }
      const tabs = [...state.tabs];
      tabs[index] = { ...tabs[index], exited: detail };
      return { tabs };
    });
  },

  clearExited: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1 || !state.tabs[index].exited) {
        return state;
      }
      const tabs = [...state.tabs];
      tabs[index] = { ...tabs[index], exited: "" };
      return { tabs };
    });
  },

  toggle: () => {
    if (get().tabs.length === 0) {
      get().openTab();
    } else {
      get().closeAll();
    }
  },
}));

export function attachTerminalWriter(
  id: string,
  fn: (chunk: string) => void
): () => void {
  writers.set(id, fn);
  const buffered = pending.get(id);
  if (buffered) {
    pending.delete(id);
    fn(buffered);
  }
  return () => {
    if (writers.get(id) === fn) {
      writers.delete(id);
    }
  };
}

function pushData(id: string, chunk: string): void {
  const writer = writers.get(id);
  if (writer) {
    writer(chunk);
    return;
  }
  const live = useTerminalStore.getState().tabs.some((tab) => tab.id === id);
  if (!live) {
    return;
  }
  pending.set(id, ((pending.get(id) ?? "") + chunk).slice(-MAX_PENDING));
}

try {
  runtime.EventsOn(EVENT_DATA, (id: unknown, chunk: unknown) => {
    if (typeof id === "string" && id && typeof chunk === "string" && chunk) {
      pushData(id, chunk);
    }
  });
  runtime.EventsOn(EVENT_EXIT, (id: unknown, detail: unknown) => {
    if (typeof id !== "string" || !id) {
      return;
    }
    writers.delete(id);
    pending.delete(id);
    useTerminalStore
      .getState()
      .markExited(id, typeof detail === "string" ? detail : "");
  });
} catch {
}
