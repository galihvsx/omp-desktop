import { nanoid } from "nanoid";
import { toast } from "sonner";
import { create } from "zustand";
import * as runtime from "../../../../wailsjs/runtime/runtime";
import { t, type TranslationKey } from "@/lib/i18n";
import {
 callCheckSessionInUse,
 callListRunningSessions,
 callReadSessionPage,
 callSendSession,
 callStartSession,
 callStopAllSessions,
 callStopSession,
} from "@/lib/repositories/session";
import type { AgentContentBlock, SessionPage } from "@/lib/repositories/types";


export interface OmpTextPart {
 type: "text";
 text: string;
}

export interface OmpReasoningPart {
 type: "reasoning";
 text: string;
}

export interface OmpToolPart {
 type: `tool-${string}`;
 toolCallId: string;
 state:
 | "input-streaming"
 | "input-available"
 | "output-available"
 | "output-error";
 input?: unknown;
 output?: unknown;
 outputDetails?: unknown;
 errorText?: string;
}

export type OmpMessagePart = OmpTextPart | OmpReasoningPart | OmpToolPart;

export interface OmpMessage {
 id: string;
 role: "user" | "assistant";
 parts: OmpMessagePart[];
 startedAt?: number;
 endedAt?: number;
}

export type OmpApprovalMethod = "select" | "confirm" | "input";

export interface OmpPendingApproval {
 id: string;
 method: OmpApprovalMethod;
 title: string;
 options: string[];
}

export type SessionStatus = "disconnected" | "connecting" | "ready" | "busy";

export type QueuedMessageQueue = "steering" | "followUp";

export interface QueuedMessages {
 steering: string[];
 followUp: string[];
}

export type InterruptMode = "immediate" | "wait";

export type QueueMode = "all" | "one-at-a-time";

export type StartOptions = {
 model?: string;
 thinkingLevel?: string;
 approvalMode?: string;
};

export interface SessionRuntime {
 key: string;
 sessionFile: string | null;
 cwd: string;
 title: string;
 status: SessionStatus;
 messages: OmpMessage[];
 pendingApproval: OmpPendingApproval | null;
  hydrated: boolean;
  loadedFrom: number;
  totalMessages: number;
  start: StartOptions;
  model: string | null;
  thinkingLevel: string | null;
  queued: QueuedMessages;
  interruptMode: InterruptMode | null;
  steeringMode: QueueMode | null;
  followUpMode: QueueMode | null;
  sessionInUse: boolean;
}

export type OpenSessionInput = {
 key: string;
 sessionFile: string | null;
 cwd: string;
 title: string;
 start?: StartOptions;
};

interface OmpSessionState {
 sessions: Record<string, SessionRuntime>;
 activeKey: string | null;
 open: (input: OpenSessionInput) => Promise<void>;
 setActive: (key: string) => void;
 close: (key: string) => Promise<void>;
 stop: (key: string) => Promise<void>;
 send: (text: string) => Promise<void>;
 queueMessage: (text: string) => Promise<void>;
 steerQueued: (text: string) => Promise<void>;
 removeQueued: (
  text: string,
  queue: QueuedMessageQueue
 ) => Promise<boolean>;
 reorderQueued: (
  queue: QueuedMessageQueue,
  fromIndex: number,
  toIndex: number
 ) => Promise<void>;
 setInterruptMode: (mode: InterruptMode) => Promise<void>;
 setSteeringMode: (mode: QueueMode) => Promise<void>;
 setFollowUpMode: (mode: QueueMode) => Promise<void>;
 abort: () => Promise<void>;
  respondApproval: (value: string) => Promise<void>;
  setModel: (selector: string) => Promise<void>;
  setThinkingLevel: (level: string) => Promise<void>;
  stopAll: () => Promise<void>;
  loadEarlier: () => Promise<void>;
  hasEarlier: () => boolean;
  recheckSessionInUse: () => Promise<void>;
}


interface OmpAssistantMessageEvent {
 type: string;
 delta?: string;
 [key: string]: unknown;
}

interface OmpFrame {
 type: string;
 id?: string;
 message?: { id?: string; role?: string; [key: string]: unknown };
 assistantMessageEvent?: OmpAssistantMessageEvent;
 toolCallId?: string;
 toolName?: string;
 args?: unknown;
 result?: unknown;
 error?: string;
  success?: boolean;
  command?: unknown;
  data?: unknown;
  method?: string;
  title?: string;
  options?: unknown;
  timeout?: unknown;
  targetId?: string;
  model?: unknown;
  thinkingLevel?: unknown;
  steering?: unknown;
  followUp?: unknown;
  [key: string]: unknown;
}


const FLUSH_INTERVAL_MS = 50;
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 50;

const PAGE = 40;

interface StreamState {
 messageId: string | null;
 timer: ReturnType<typeof setTimeout> | null;
 dirty: boolean;
}

const streams = new Map<string, StreamState>();

const approvalTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearApprovalTimer(key: string): void {
 const timer = approvalTimers.get(key);
 if (timer !== undefined) {
  clearTimeout(timer);
  approvalTimers.delete(key);
 }
}

const hydrating = new Set<string>();

const loadingEarlier = new Set<string>();

const expectedStops = new Set<string>();

function errorText(error: unknown): string {
 return error instanceof Error ? error.message : String(error);
}

function modelSelectorFrom(value: unknown): string | null {
 if (!value || typeof value !== "object") {
  return null;
 }
 if (!("provider" in value) || !("id" in value)) {
  return null;
 }
 const provider = value.provider;
 const id = value.id;
 if (typeof provider !== "string" || !provider) {
  return null;
 }
 if (typeof id !== "string" || !id) {
  return null;
 }
 return `${provider}/${id}`;
}

function thinkingLevelFrom(value: unknown): string | null {
 return typeof value === "string" && value ? value : null;
}

function interruptModeFrom(value: unknown): InterruptMode | null {
 return value === "immediate" || value === "wait" ? value : null;
}

function queueModeFrom(value: unknown): QueueMode | null {
 return value === "all" || value === "one-at-a-time" ? value : null;
}

function stringList(value: unknown): string[] | null {
 if (!Array.isArray(value)) {
  return null;
 }
 return value.filter((item): item is string => typeof item === "string");
}

function queuedPatch(value: unknown): Partial<QueuedMessages> | null {
 if (!value || typeof value !== "object") {
  return null;
 }
 const patch: Partial<QueuedMessages> = {};
 if ("steering" in value) {
  const steering = stringList(value.steering);
  if (steering) {
   patch.steering = steering;
  }
 }
 if ("followUp" in value) {
  const followUp = stringList(value.followUp);
  if (followUp) {
   patch.followUp = followUp;
  }
 }
 return Object.keys(patch).length > 0 ? patch : null;
}

function commandTypeOf(command: unknown): string {
 if (typeof command === "string") {
  return command;
 }
 if (
  command &&
  typeof command === "object" &&
  "type" in command &&
  typeof command.type === "string"
 ) {
  return command.type;
 }
 return "";
}

function applyIdentity(
 key: string,
 model: string | null,
 level: string | null
): void {
 const patch: Partial<SessionRuntime> = {};
 if (model) {
  patch.model = model;
 }
 if (level) {
  patch.thinkingLevel = level;
 }
 if (Object.keys(patch).length > 0) {
  patchRuntime(key, patch);
 }
}

function applyQueueState(key: string, data: object): void {
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 const patch: Partial<SessionRuntime> = {};
 if ("queuedMessages" in data) {
  const queued = queuedPatch(data.queuedMessages);
  if (queued) {
   patch.queued = { ...current.queued, ...queued };
  }
 }
 if ("interruptMode" in data) {
  const mode = interruptModeFrom(data.interruptMode);
  if (mode) {
   patch.interruptMode = mode;
  }
 }
 if ("steeringMode" in data) {
  const mode = queueModeFrom(data.steeringMode);
  if (mode) {
   patch.steeringMode = mode;
  }
 }
 if ("followUpMode" in data) {
  const mode = queueModeFrom(data.followUpMode);
  if (mode) {
   patch.followUpMode = mode;
  }
 }
 if (Object.keys(patch).length > 0) {
  patchRuntime(key, patch);
 }
}

function streamFor(key: string): StreamState {
 const existing = streams.get(key);
 if (existing) {
  return existing;
 }
 const created: StreamState = { messageId: null, timer: null, dirty: false };
 streams.set(key, created);
 return created;
}

function dropStream(key: string): void {
 const stream = streams.get(key);
 if (stream?.timer) {
  clearTimeout(stream.timer);
 }
 streams.delete(key);
}

function patchRuntime(key: string, patch: Partial<SessionRuntime>): void {
 useOmpSessionStore.setState((state) => {
  const current = state.sessions[key];
  if (!current) {
   return state;
  }
  return { sessions: { ...state.sessions, [key]: { ...current, ...patch } } };
 });
}

function activeKeyOf(): string | null {
 const { activeKey, sessions } = useOmpSessionStore.getState();
 return activeKey && sessions[activeKey] ? activeKey : null;
}

async function sendQueueCommand(
 key: string,
 command: Record<string, unknown>,
 errorKey: TranslationKey
): Promise<boolean> {
 try {
  await callSendSession(key, JSON.stringify({ id: nanoid(), ...command }));
  return true;
 } catch (error) {
  toast.error(t(errorKey), { description: errorText(error) });
  return false;
 }
}

function flushNow(key: string): void {
 const stream = streams.get(key);
 if (stream?.timer) {
  clearTimeout(stream.timer);
  stream.timer = null;
 }
 if (!stream?.dirty) {
  return;
 }
 stream.dirty = false;
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 patchRuntime(key, { messages: [...current.messages] });
}

function scheduleFlush(key: string): void {
 const stream = streamFor(key);
 stream.dirty = true;
 if (stream.timer !== null) {
  return;
 }
 stream.timer = setTimeout(() => flushNow(key), FLUSH_INTERVAL_MS);
}

function isToolPart(part: OmpMessagePart): part is OmpToolPart {
 return part.type.startsWith("tool-");
}

function ensureAssistantMessage(key: string): OmpMessage | null {
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return null;
 }
 const stream = streamFor(key);
 if (stream.messageId) {
  const existing = current.messages.find((m) => m.id === stream.messageId);
  if (existing) {
   return markTurnLive(key, current, existing);
  }
 }
 const last = current.messages.at(-1);
 if (last && last.role === "assistant") {
  stream.messageId = last.id;
  return markTurnLive(key, current, last);
 }
 const message: OmpMessage = {
  id: nanoid(),
  role: "assistant",
  parts: [],
  startedAt: Date.now(),
 };
 stream.messageId = message.id;
 patchRuntime(key, { messages: [...current.messages, message] });
 return message;
}

function markTurnLive(
 key: string,
 current: SessionRuntime,
 message: OmpMessage
): OmpMessage {
 if (message.startedAt !== undefined && message.endedAt === undefined) {
  return message;
 }
 const live: OmpMessage = {
  ...message,
  startedAt: message.startedAt ?? Date.now(),
  endedAt: undefined,
 };
 patchRuntime(key, {
  messages: current.messages.map((candidate) =>
   candidate.id === message.id ? live : candidate
  ),
 });
 return live;
}

function appendDelta(
 key: string,
 kind: "text" | "reasoning",
 delta: string
): void {
 if (!delta) {
  return;
 }
 const message = ensureAssistantMessage(key);
 if (!message) {
  return;
 }
 const last = message.parts.at(-1);
 if (last?.type === "text" && kind === "text") {
  last.text += delta;
 } else if (last?.type === "reasoning" && kind === "reasoning") {
  last.text += delta;
 } else if (kind === "text") {
  message.parts.push({ type: "text", text: delta });
 } else {
  message.parts.push({ type: "reasoning", text: delta });
 }
 scheduleFlush(key);
}

function extractResultDetails(result: unknown): unknown {
 if (result && typeof result === "object" && !Array.isArray(result) && "details" in result) {
  return result.details;
 }
 return undefined;
}

function extractResultText(result: unknown): string | null {
 const collect = (value: unknown): string | null => {
  if (!Array.isArray(value)) {
   return null;
  }
  const texts: string[] = [];
  for (const item of value) {
   if (item && typeof item === "object" && "text" in item) {
    const text = item.text;
    if (typeof text === "string") {
     texts.push(text);
    }
   }
  }
  return texts.length > 0 ? texts.join("\n") : null;
 };

 if (typeof result === "string") {
  return result;
 }
 const fromResult = collect(result);
 if (fromResult !== null) {
  return fromResult;
 }
 if (result && typeof result === "object" && "content" in result) {
  return collect(result.content);
 }
 return null;
}

function stampTurnSpan(
 messages: OmpMessage[],
 index: number,
 startAt: number | undefined,
 endAt: number | undefined
): void {
 if (index < 0 || startAt === undefined || endAt === undefined) {
  return;
 }
 if (endAt < startAt) {
  return;
 }
 const message = messages[index];
 message.startedAt = startAt;
 message.endedAt = endAt;
}

function transcriptMessages(page: SessionPage): OmpMessage[] {
 const messages: OmpMessage[] = [];
 const toolParts = new Map<string, OmpToolPart>();
 let turnStartAt: number | undefined;
 let turnEndIndex = -1;
 let turnEndAt: number | undefined;

 for (const message of page.messages ?? []) {
  const role = typeof message.role === "string" ? message.role : "";

  if (role === "toolResult") {
   const toolCallId =
    typeof message.toolCallId === "string" ? message.toolCallId : "";
   const part = toolCallId ? toolParts.get(toolCallId) : undefined;
   if (!part) {
    continue;
   }
   const text = extractResultText(message.content);
   if (message.isError === true) {
    part.state = "output-error";
    part.errorText = text ?? t("common.toolFailed");
   } else {
    part.state = "output-available";
    part.output = text ?? message.content ?? "";
    part.outputDetails = message.details;
   }
   continue;
  }

  if (role !== "user" && role !== "assistant") {
   continue;
  }

  const blocks: AgentContentBlock[] = Array.isArray(message.content)
   ? message.content
   : typeof message.content === "string" && message.content
    ? [{ type: "text", text: message.content }]
    : [];

  const parts: OmpMessagePart[] = [];
  for (const block of blocks) {
   const type = typeof block?.type === "string" ? block.type : "";
   if (type === "text" && typeof block.text === "string" && block.text) {
    parts.push({ type: "text", text: block.text });
   } else if (
    type === "thinking" &&
    typeof block.thinking === "string" &&
    block.thinking
   ) {
    parts.push({ type: "reasoning", text: block.thinking });
   } else if (type === "toolCall") {
    const toolCallId =
     typeof block.id === "string" && block.id ? block.id : nanoid();
    const toolName =
     typeof block.name === "string" && block.name
      ? block.name
      : t("common.unknownTool");
    const part: OmpToolPart = {
     type: `tool-${toolName}`,
     toolCallId,
     state: "input-available",
     input: block.arguments ?? {},
    };
    parts.push(part);
    toolParts.set(toolCallId, part);
   }
  }

  if (parts.length === 0) {
   continue;
  }
  const at = typeof message.timestamp === "number" ? message.timestamp : undefined;
  messages.push({ id: nanoid(), role, parts });
  if (role === "user") {
   stampTurnSpan(messages, turnEndIndex, turnStartAt, turnEndAt);
   turnStartAt = at;
   turnEndIndex = -1;
   turnEndAt = undefined;
  } else {
   turnEndIndex = messages.length - 1;
   turnEndAt = at;
  }
 }

 stampTurnSpan(messages, turnEndIndex, turnStartAt, turnEndAt);
 return messages;
}

async function hydrate(key: string, sessionFile: string): Promise<void> {
 if (hydrating.has(sessionFile)) {
  return;
 }
 hydrating.add(sessionFile);
 try {
  const page = await callReadSessionPage(sessionFile, 0, PAGE);
  const current = useOmpSessionStore.getState().sessions[key];
  if (!current) {
   return;
  }
  const history = transcriptMessages(page);
  const messages =
   current.messages.length > 0 ? [...history, ...current.messages] : history;
  patchRuntime(key, {
   messages,
   hydrated: true,
   sessionFile: current.sessionFile ?? sessionFile,
   loadedFrom: page.start,
   totalMessages: page.total,
  });
 } catch (error) {
  toast.error(t("common.historyReadFailed"), {
   description: errorText(error),
  });
 } finally {
  hydrating.delete(sessionFile);
 }
}

async function ensureChild(key: string): Promise<boolean> {
 const target = useOmpSessionStore.getState().sessions[key];
 if (!target) {
  return false;
 }
 const resume = target.sessionFile ?? "";
 if (resume) {
  try {
   const probe = await callCheckSessionInUse(resume);
   if (probe.inUse) {
    patchRuntime(key, { sessionInUse: true });
    return false;
   }
  } catch {
  }
 }
 patchRuntime(key, { status: "connecting" });
 try {
  await callStartSession(key, {
   cwd: target.cwd,
   resume,
   ...target.start,
  });
 } catch (error) {
  patchRuntime(key, { status: "disconnected" });
  if (errorText(error).includes("running in another omp process")) {
   patchRuntime(key, { sessionInUse: true });
   return false;
  }
  toast.error(t("common.sessionStartFailed"), { description: errorText(error) });
  return false;
 }

 const deadline = Date.now() + READY_TIMEOUT_MS;
 while (Date.now() < deadline) {
  const status = useOmpSessionStore.getState().sessions[key]?.status;
  if (status === "ready") {
   return true;
  }
  if (!status) {
   return false;
  }
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, READY_POLL_MS);
  await promise;
 }
 patchRuntime(key, { status: "disconnected" });
 await stopChild(key);
 toast.error(t("common.sessionNotResponding"), {
  description: t("common.sessionStartTimeout"),
 });
 return false;
}

async function stopChild(key: string): Promise<void> {
 const running = await callListRunningSessions().catch(() => null);
 if (running && !running.includes(key)) {
  return;
 }
 expectedStops.add(key);
 try {
  await callStopSession(key);
 } catch (error) {
  expectedStops.delete(key);
  toast.error(t("common.sessionStopFailed"), { description: errorText(error) });
 }
}

function handleToolExecutionStart(key: string, frame: OmpFrame): void {
 const toolCallId =
  typeof frame.toolCallId === "string" && frame.toolCallId
   ? frame.toolCallId
   : nanoid();
 const toolName =
  typeof frame.toolName === "string" && frame.toolName.length > 0
   ? frame.toolName
   : t("common.unknownTool");
 const message = ensureAssistantMessage(key);
 if (!message) {
  return;
 }
 const existing = message.parts.find(
  (part) => isToolPart(part) && part.toolCallId === toolCallId
 );
 if (existing) {
  const toolPart = existing as OmpToolPart;
  toolPart.state = "input-available";
  toolPart.input = frame.args ?? toolPart.input ?? {};
 } else {
  message.parts.push({
   type: `tool-${toolName}`,
   toolCallId,
   state: "input-available",
   input: frame.args ?? {},
  });
 }
 flushNow(key);
}

function handleToolExecutionEnd(key: string, frame: OmpFrame): void {
 const toolCallId = frame.toolCallId;
 if (typeof toolCallId !== "string") {
  return;
 }
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 const messages = current.messages;
 for (let i = messages.length - 1; i >= 0; i--) {
  const part = messages[i].parts.find(
   (candidate) => isToolPart(candidate) && candidate.toolCallId === toolCallId
  );
  if (!part) {
   continue;
  }
  const toolPart = part as OmpToolPart;
  if (typeof frame.error === "string" && frame.error.length > 0) {
   toolPart.state = "output-error";
   toolPart.errorText = frame.error;
  } else {
   const text = extractResultText(frame.result);
   toolPart.state = "output-available";
   toolPart.output = text ?? frame.result ?? "";
   toolPart.outputDetails = extractResultDetails(frame.result);
  }
  flushNow(key);
  return;
 }
}

function handleMessageStart(key: string, frame: OmpFrame): void {
 const role =
  typeof frame.message?.role === "string" ? frame.message.role : "assistant";
 if (role !== "assistant") {
  return;
 }
 const id =
  typeof frame.message?.id === "string" && frame.message.id
   ? frame.message.id
   : typeof frame.id === "string" && frame.id
    ? frame.id
    : nanoid();
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 const stream = streamFor(key);
 if (current.messages.some((m) => m.id === id)) {
  stream.messageId = id;
  return;
 }
 stream.messageId = id;
 patchRuntime(key, {
  messages: [
   ...current.messages,
   { id, role: "assistant", parts: [], startedAt: Date.now() },
  ],
 });
}

function handleMessageUpdate(key: string, frame: OmpFrame): void {
 const event = frame.assistantMessageEvent;
 if (!event || typeof event.type !== "string") {
  return;
 }
 const delta = typeof event.delta === "string" ? event.delta : "";
 switch (event.type) {
  case "text_delta":
   appendDelta(key, "text", delta);
   break;
  case "thinking_delta":
   appendDelta(key, "reasoning", delta);
   break;
  case "toolcall_delta":
  default:
   break;
 }
}

function handleResponse(key: string, frame: OmpFrame): void {
 const type = commandTypeOf(frame.command);
 if (frame.success !== false) {
  if (type === "get_state") {
   const data = frame.data;
   if (data && typeof data === "object") {
    const model = "model" in data ? modelSelectorFrom(data.model) : null;
    const level =
     "thinkingLevel" in data ? thinkingLevelFrom(data.thinkingLevel) : null;
    applyIdentity(key, model, level);
    applyQueueState(key, data);
   }
  }
  return;
 }
 const description =
  typeof frame.error === "string" && frame.error
   ? frame.error
   : t("common.commandRejected");
 toast.error(t("common.commandFailed"), { description });

 if (type === "prompt") {
  if (useOmpSessionStore.getState().sessions[key]?.status === "busy") {
   patchRuntime(key, { status: "ready" });
  }
 }
}

function handleApprovalRequest(key: string, frame: OmpFrame): void {
 const id = typeof frame.id === "string" ? frame.id : "";
 if (!id) {
  return;
 }
 const method = frame.method;

 if (method === "cancel") {
  const target = typeof frame.targetId === "string" ? frame.targetId : "";
  if (target && useOmpSessionStore.getState().sessions[key]?.pendingApproval?.id === target) {
   clearApprovalTimer(key);
   patchRuntime(key, { pendingApproval: null });
  }
  return;
 }

 if (method === "setTitle") {
  if (typeof frame.title === "string" && frame.title) {
   patchRuntime(key, { title: frame.title });
  }
  return;
 }

 if (method !== "select" && method !== "confirm" && method !== "input") {
  return;
 }

 const options = Array.isArray(frame.options)
  ? frame.options.filter((option): option is string => typeof option === "string")
  : [];
 clearApprovalTimer(key);
 patchRuntime(key, {
  pendingApproval: {
   id,
   method,
   title:
    typeof frame.title === "string" && frame.title
     ? frame.title
     : t("common.approvalRequested"),
   options,
  },
 });

 const timeout =
  typeof frame.timeout === "number" && frame.timeout > 0 ? frame.timeout : 0;
 if (timeout > 0) {
  approvalTimers.set(
   key,
   setTimeout(() => {
    approvalTimers.delete(key);
    if (useOmpSessionStore.getState().sessions[key]?.pendingApproval?.id === id) {
     patchRuntime(key, { pendingApproval: null });
    }
   }, timeout)
  );
 }
}

function finishRun(key: string): void {
 const stream = streams.get(key);
 if (stream) {
  stream.messageId = null;
 }
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 const patch: Partial<SessionRuntime> = { status: "ready" };
 if (current.pendingApproval) {
  clearApprovalTimer(key);
  patch.pendingApproval = null;
 }
 const endedAt = Date.now();
 const last = current.messages.at(-1);
 if (
  last &&
  last.role === "assistant" &&
  last.startedAt !== undefined &&
  last.endedAt === undefined
 ) {
  patch.messages = current.messages.map((candidate) =>
   candidate.id === last.id ? { ...candidate, endedAt } : candidate
  );
 }
 patchRuntime(key, patch);
 flushNow(key);
}

function handleFrame(key: string, payload: unknown): void {
 if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
  return;
 }
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 const frame = payload as OmpFrame;
 switch (frame.type) {
  case "ready":
   if (current.status === "connecting" || current.status === "disconnected") {
    patchRuntime(key, { status: "ready" });
   }
   break;
  case "response":
   handleResponse(key, frame);
   break;
  case "agent_start":
  case "turn_start":
   if (current.status !== "busy") {
    patchRuntime(key, { status: "busy" });
   }
   break;
  case "message_start":
   handleMessageStart(key, frame);
   break;
  case "message_update":
   handleMessageUpdate(key, frame);
   break;
  case "message_end": {
   const stream = streams.get(key);
   if (
    stream?.messageId &&
    (frame.message?.id === stream.messageId || frame.id === stream.messageId)
   ) {
    stream.messageId = null;
   }
   flushNow(key);
   break;
  }
  case "tool_execution_start":
   handleToolExecutionStart(key, frame);
   break;
  case "tool_execution_end":
   handleToolExecutionEnd(key, frame);
   break;
  case "turn_end":
  case "agent_end":
  case "session_settled":
   finishRun(key);
   break;
  case "extension_ui_request":
   handleApprovalRequest(key, frame);
   break;
  case "thinking_level_changed":
   applyIdentity(key, null, thinkingLevelFrom(frame.thinkingLevel));
   break;
  case "config_update":
   applyIdentity(
    key,
    modelSelectorFrom(frame.model),
    thinkingLevelFrom(frame.thinkingLevel)
   );
   break;
  case "queue_update": {
   const queued = queuedPatch(frame);
   if (queued) {
    patchRuntime(key, { queued: { ...current.queued, ...queued } });
   }
   break;
  }
  case "rpc_parse_error":
   break;
  default:
   break;
 }
}

function handleRpcExit(key: string, detail: string): void {
 const stream = streams.get(key);
 if (stream) {
  stream.messageId = null;
 }
 clearApprovalTimer(key);
 if (useOmpSessionStore.getState().sessions[key]) {
  patchRuntime(key, {
   status: "disconnected",
   pendingApproval: null,
   queued: { steering: [], followUp: [] },
   interruptMode: null,
   steeringMode: null,
   followUpMode: null,
  });
 }
 flushNow(key);
 if (expectedStops.delete(key)) {
  return;
 }
 toast.error(t("common.rpcExited"), {
  description: detail || t("common.rpcExitedHint"),
 });
}

function handleSession(key: string, sessionFile: string): void {
 const current = useOmpSessionStore.getState().sessions[key];
 if (!current) {
  return;
 }
 const patch: Partial<SessionRuntime> = {};
 if (sessionFile && current.sessionFile !== sessionFile) {
  patch.sessionFile = sessionFile;
 }
 if (Object.keys(patch).length > 0) {
  patchRuntime(key, patch);
 }
}

export const useOmpSessionStore = create<OmpSessionState>()((set, get) => ({
 sessions: {},
 activeKey: null,

 open: async (input) => {
  if (input.sessionFile) {
   const existing = Object.values(get().sessions).find(
    (session) =>
     session.sessionFile === input.sessionFile ||
     session.key === input.sessionFile
   );
   if (existing) {
    set({ activeKey: existing.key });
    return;
   }
  }

  const current = get().sessions[input.key];
  if (current) {
   patchRuntime(input.key, {
    sessionFile: current.sessionFile ?? input.sessionFile,
    cwd: current.cwd || input.cwd,
    title: current.title || input.title,
    start: { ...current.start, ...input.start },
   });
  } else {
   set((state) => ({
    sessions: {
     ...state.sessions,
     [input.key]: {
      key: input.key,
      sessionFile: input.sessionFile,
      cwd: input.cwd,
      title: input.title,
      status: "disconnected",
      messages: [],
      pendingApproval: null,
      hydrated: false,
      loadedFrom: 0,
      totalMessages: 0,
      start: input.start ?? {},
      model: null,
      thinkingLevel: null,
      queued: { steering: [], followUp: [] },
      interruptMode: null,
      steeringMode: null,
      followUpMode: null,
      sessionInUse: false,
     },
    },
   }));
  }
  set({ activeKey: input.key });

  const opened = get().sessions[input.key];
  if (
   opened?.sessionFile &&
   !opened.hydrated &&
   opened.status === "disconnected"
  ) {
   await hydrate(input.key, opened.sessionFile);
  }
  if (
   opened?.sessionFile &&
   opened.status !== "ready" &&
   opened.status !== "busy"
  ) {
   try {
    const result = await callCheckSessionInUse(opened.sessionFile);
    patchRuntime(input.key, { sessionInUse: result.inUse });
   } catch {
   }
  }
},
 setActive: (key) => {
  if (get().sessions[key]) {
   set({ activeKey: key });
  }
 },


 loadEarlier: async () => {
  const key = get().activeKey;
  const runtime = key ? get().sessions[key] : undefined;
  if (!key || !runtime?.sessionFile || runtime.loadedFrom === 0) {
   return;
  }
  if (loadingEarlier.has(key)) {
   return;
  }
  loadingEarlier.add(key);
  try {
   const page = await callReadSessionPage(
    runtime.sessionFile,
    runtime.loadedFrom,
    PAGE
   );
   const current = get().sessions[key];
   if (!current) {
    return;
   }
   const earlier = transcriptMessages(page);
   patchRuntime(key, {
    messages: [...earlier, ...current.messages],
    loadedFrom: page.start,
    totalMessages: page.total,
   });
  } catch (error) {
   toast.error(t("common.historyReadFailed"), {
    description: errorText(error),
   });
  } finally {
   loadingEarlier.delete(key);
  }
 },

 hasEarlier: () => {
  const key = get().activeKey;
  const runtime = key ? get().sessions[key] : undefined;
  return (runtime?.loadedFrom ?? 0) > 0;
 },

 recheckSessionInUse: async () => {
  const key = get().activeKey;
  const runtime = key ? get().sessions[key] : undefined;
  if (!key || !runtime?.sessionFile) {
   return;
  }
  try {
   const result = await callCheckSessionInUse(runtime.sessionFile);
   patchRuntime(key, { sessionInUse: result.inUse });
  } catch (error) {
   toast.error(t("common.commandFailed"), { description: errorText(error) });
  }
 },

 close: async (key) => {
  if (!get().sessions[key]) {
   return;
  }
  await stopChild(key);
  dropStream(key);
  clearApprovalTimer(key);
  set((state) => {
   const sessions = { ...state.sessions };
   delete sessions[key];
   return {
    sessions,
    activeKey: state.activeKey === key ? null : state.activeKey,
   };
  });
 },

 stop: async (key) => {
  if (!get().sessions[key]) {
   return;
  }
  await stopChild(key);
  dropStream(key);
  clearApprovalTimer(key);
  patchRuntime(key, {
   status: "disconnected",
   pendingApproval: null,
   queued: { steering: [], followUp: [] },
   interruptMode: null,
   steeringMode: null,
   followUpMode: null,
  });
 },

 send: async (text) => {
  await get().queueMessage(text);
 },

 queueMessage: async (text) => {
  const trimmed = text.trim();
  if (!trimmed) {
   return;
  }
  const key = get().activeKey;
  const target = key ? get().sessions[key] : undefined;
  if (!key || !target) {
   return;
  }
  if (target.status === "connecting") {
   return;
  }
  if (target.status === "busy") {
   await sendQueueCommand(
    key,
    { type: "follow_up", message: trimmed },
    "workspace.queueFailed"
   );
   return;
  }
  if (target.status === "disconnected" && !(await ensureChild(key))) {
   return;
  }
  const ready = get().sessions[key];
  if (!ready) {
   return;
  }
  const userMessage: OmpMessage = {
   id: nanoid(),
   role: "user",
   parts: [{ type: "text", text: trimmed }],
  };
  patchRuntime(key, { messages: [...ready.messages, userMessage] });
  try {
   await callSendSession(
    key,
    JSON.stringify({ id: nanoid(), type: "prompt", message: trimmed })
   );
   patchRuntime(key, { status: "busy" });
  } catch (error) {
   const current = get().sessions[key];
   if (current) {
    patchRuntime(key, {
     messages: current.messages.filter((m) => m.id !== userMessage.id),
    });
   }
   toast.error(t("common.sendFailed"), { description: errorText(error) });
  }
 },

 steerQueued: async (text) => {
  const key = activeKeyOf();
  if (!key) {
   return;
  }
  await sendQueueCommand(
   key,
   { type: "promote_queued_message", message: text },
   "workspace.queueSteerFailed"
  );
 },

 removeQueued: async (text, queue) => {
  const key = activeKeyOf();
  if (!key) {
   return false;
  }
  return await sendQueueCommand(
   key,
   { type: "remove_queued_message", message: text, queue },
   "workspace.queueRemoveFailed"
  );
 },

 reorderQueued: async (queue, fromIndex, toIndex) => {
  const key = activeKeyOf();
  const target = key ? get().sessions[key] : undefined;
  if (!key || !target) {
   return;
  }
  const items = target.queued[queue];
  if (fromIndex === toIndex) {
   return;
  }
  if (fromIndex < 0 || fromIndex >= items.length) {
   return;
  }
  if (toIndex < 0 || toIndex >= items.length) {
   return;
  }
  if (new Set(items).size !== items.length) {
   toast.error(t("workspace.queueReorderBlocked"), {
    description: t("workspace.queueReorderDuplicate"),
   });
   return;
  }
  if (items.some((item) => item.startsWith("/"))) {
   toast.error(t("workspace.queueReorderBlocked"), {
    description: t("workspace.queueReorderSlash"),
   });
   return;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  for (const text of items) {
   const removed = await sendQueueCommand(
    key,
    { type: "remove_queued_message", message: text, queue },
    "workspace.queueReorderFailed"
   );
   if (!removed) {
    return;
   }
  }
  const add = queue === "steering" ? "steer" : "follow_up";
  for (const text of next) {
   await sendQueueCommand(
    key,
    { type: add, message: text },
    "workspace.queueReorderFailed"
   );
  }
 },

 setInterruptMode: async (mode) => {
  const key = activeKeyOf();
  const target = key ? get().sessions[key] : undefined;
  if (!key || !target) {
   return;
  }
  const previous = target.interruptMode;
  patchRuntime(key, { interruptMode: mode });
  const sent = await sendQueueCommand(
   key,
   { type: "set_interrupt_mode", mode },
   "workspace.queueModeFailed"
  );
  if (!sent) {
   patchRuntime(key, { interruptMode: previous });
  }
 },

 setSteeringMode: async (mode) => {
  const key = activeKeyOf();
  const target = key ? get().sessions[key] : undefined;
  if (!key || !target) {
   return;
  }
  const previous = target.steeringMode;
  patchRuntime(key, { steeringMode: mode });
  const sent = await sendQueueCommand(
   key,
   { type: "set_steering_mode", mode },
   "workspace.queueModeFailed"
  );
  if (!sent) {
   patchRuntime(key, { steeringMode: previous });
  }
 },

 setFollowUpMode: async (mode) => {
  const key = activeKeyOf();
  const target = key ? get().sessions[key] : undefined;
  if (!key || !target) {
   return;
  }
  const previous = target.followUpMode;
  patchRuntime(key, { followUpMode: mode });
  const sent = await sendQueueCommand(
   key,
   { type: "set_follow_up_mode", mode },
   "workspace.queueModeFailed"
  );
  if (!sent) {
   patchRuntime(key, { followUpMode: previous });
  }
 },

 abort: async () => {
  const key = get().activeKey;
  if (!key || get().sessions[key]?.status !== "busy") {
   return;
  }
  try {
   await callSendSession(key, JSON.stringify({ id: nanoid(), type: "abort" }));
  } catch (error) {
   toast.error(t("common.abortFailed"), { description: errorText(error) });
  }
 },

 respondApproval: async (value) => {
  const key = get().activeKey;
  if (!key) {
   return;
  }
  const approval = get().sessions[key]?.pendingApproval;
  if (!approval) {
   return;
  }
  clearApprovalTimer(key);
  patchRuntime(key, { pendingApproval: null });
  const response =
   approval.method === "confirm"
    ? {
     id: approval.id,
     type: "extension_ui_response",
     confirmed: value === "true",
    }
    : { id: approval.id, type: "extension_ui_response", value };
  try {
   await callSendSession(key, JSON.stringify(response));
  } catch (error) {
   toast.error(t("common.respondFailed"), { description: errorText(error) });
  }
 },

 setModel: async (selector) => {
  const key = get().activeKey;
  const active = key ? get().sessions[key] : undefined;
  if (!key || !active || active.status === "disconnected" || active.status === "connecting") {
   return;
  }
  const slash = selector.indexOf("/");
  if (slash <= 0 || slash === selector.length - 1) {
   return;
  }
  patchRuntime(key, { model: selector });
  try {
   await callSendSession(
    key,
    JSON.stringify({
     id: nanoid(),
     type: "set_model",
     provider: selector.slice(0, slash),
     modelId: selector.slice(slash + 1),
    })
   );
  } catch (error) {
   toast.error(t("common.commandFailed"), { description: errorText(error) });
  }
 },

 setThinkingLevel: async (level) => {
  const key = get().activeKey;
  const active = key ? get().sessions[key] : undefined;
  if (!key || !active || active.status === "disconnected" || active.status === "connecting") {
   return;
  }
  patchRuntime(key, { thinkingLevel: level });
  try {
   await callSendSession(
    key,
    JSON.stringify({
     id: nanoid(),
     type: "set_thinking_level",
     level,
    })
   );
  } catch (error) {
   toast.error(t("common.commandFailed"), { description: errorText(error) });
  }
 },

 stopAll: async () => {
  for (const key of Object.keys(get().sessions)) {
   expectedStops.add(key);
  }
  try {
   await callStopAllSessions();
  } catch (error) {
   toast.error(t("common.sessionStopFailed"), { description: errorText(error) });
  }
  for (const key of Object.keys(get().sessions)) {
   dropStream(key);
   clearApprovalTimer(key);
  }
  set((state) => {
   const sessions: Record<string, SessionRuntime> = {};
   for (const [key, session] of Object.entries(state.sessions)) {
    sessions[key] = {
     ...session,
     status: "disconnected",
     pendingApproval: null,
     queued: { steering: [], followUp: [] },
     interruptMode: null,
     steeringMode: null,
     followUpMode: null,
    };
   }
   return { sessions };
  });
 },
}));

export function useActiveRuntime(): SessionRuntime | null {
 return useOmpSessionStore((state) =>
  state.activeKey ? (state.sessions[state.activeKey] ?? null) : null
 );
}

export function useRuntime(key: string | null): SessionRuntime | null {
 return useOmpSessionStore((state) =>
  key ? (state.sessions[key] ?? null) : null
 );
}

let initialized = false;

export function initOmpStore(): void {
 if (initialized) {
  return;
 }
 initialized = true;
 try {
  runtime.EventsOn("omp:frame", (key: unknown, frame: unknown) => {
   handleFrame(typeof key === "string" ? key : "", frame);
  });
  runtime.EventsOn("omp:rpc-exit", (key: unknown, detail: unknown) => {
   handleRpcExit(
    typeof key === "string" ? key : "",
    typeof detail === "string" ? detail : ""
   );
  });
  runtime.EventsOn(
   "omp:session",
   (key: unknown, _sessionId: unknown, sessionFile: unknown) => {
    handleSession(
     typeof key === "string" ? key : "",
     typeof sessionFile === "string" ? sessionFile : ""
    );
   }
  );
 } catch {
 }
}

void initOmpStore();
