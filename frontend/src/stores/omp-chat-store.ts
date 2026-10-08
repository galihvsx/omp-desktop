import { nanoid } from "nanoid";
import { toast } from "sonner";
import { create } from "zustand";
import * as runtime from "../../wailsjs/runtime/runtime";
import { callRPCSend, callStartRPC, callStopRPC } from "@/lib/omp-rpc";

/*
 * Message shapes aligned with the AI SDK UIMessage convention so the
 * ai-elements components render them directly.
 */

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
  errorText?: string;
}

export type OmpMessagePart = OmpTextPart | OmpReasoningPart | OmpToolPart;

export interface OmpMessage {
  id: string;
  role: "user" | "assistant";
  parts: OmpMessagePart[];
}

export type OmpApprovalMethod = "select" | "confirm" | "input";

export interface OmpPendingApproval {
  id: string;
  method: OmpApprovalMethod;
  title: string;
  options: string[];
}

export type OmpChatStatus = "disconnected" | "connecting" | "ready" | "busy";

interface OmpChatState {
  status: OmpChatStatus;
  sessionId: string | null;
  messages: OmpMessage[];
  pendingApproval: OmpPendingApproval | null;
  start: (cwd?: string) => Promise<void>;
  stop: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  respondApproval: (value: string) => Promise<void>;
}

/*
 * Raw omp protocol frames (v18.6.1). Only the fields we react to are typed;
 * everything else is ignored silently.
 */

interface OmpAssistantMessageEvent {
  type: string;
  delta?: string;
  [key: string]: unknown;
}

export interface OmpFrame {
  type: string;
  id?: string;
  sessionId?: string;
  message?: { id?: string; role?: string; [key: string]: unknown };
  assistantMessageEvent?: OmpAssistantMessageEvent;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  error?: string;
  success?: boolean;
  command?: unknown;
  method?: string;
  title?: string;
  options?: unknown;
  [key: string]: unknown;
}

/*
 * Non-reactive streaming bookkeeping. Deltas mutate the tail message's parts
 * in place and a 50 ms timer publishes a new messages array, so per-token
 * frames stay cheap.
 */

const FLUSH_INTERVAL_MS = 50;

let streamingMessageId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let tailDirty = false;

function flushNow(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!tailDirty) {
    return;
  }
  tailDirty = false;
  useOmpChatStore.setState({
    messages: [...useOmpChatStore.getState().messages],
  });
}

function scheduleFlush(): void {
  tailDirty = true;
  if (flushTimer !== null) {
    return;
  }
  flushTimer = setTimeout(flushNow, FLUSH_INTERVAL_MS);
}

function isToolPart(part: OmpMessagePart): part is OmpToolPart {
  return part.type.startsWith("tool-");
}

function ensureAssistantMessage(): OmpMessage {
  const state = useOmpChatStore.getState();
  if (streamingMessageId) {
    const existing = state.messages.find((m) => m.id === streamingMessageId);
    if (existing) {
      return existing;
    }
  }
  const last = state.messages.at(-1);
  if (last && last.role === "assistant") {
    streamingMessageId = last.id;
    return last;
  }
  const message: OmpMessage = { id: nanoid(), role: "assistant", parts: [] };
  streamingMessageId = message.id;
  useOmpChatStore.setState({ messages: [...state.messages, message] });
  return message;
}

function appendDelta(kind: "text" | "reasoning", delta: string): void {
  if (!delta) {
    return;
  }
  const message = ensureAssistantMessage();
  const last = message.parts.at(-1);
  if (last && last.type === kind) {
    last.text += delta;
  } else if (kind === "text") {
    message.parts.push({ type: "text", text: delta });
  } else {
    message.parts.push({ type: "reasoning", text: delta });
  }
  scheduleFlush();
}

/** Flattens an omp tool result into displayable text when possible. */
function extractResultText(result: unknown): string | null {
  const collect = (value: unknown): string | null => {
    if (!Array.isArray(value)) {
      return null;
    }
    const texts = value
      .map((item) =>
        item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
          ? (item as { text: string }).text
          : null
      )
      .filter((text): text is string => text !== null);
    return texts.length > 0 ? texts.join("\n") : null;
  };

  if (typeof result === "string") {
    return result;
  }
  const fromResult = collect(result);
  if (fromResult !== null) {
    return fromResult;
  }
  if (result && typeof result === "object") {
    return collect((result as { content?: unknown }).content);
  }
  return null;
}

function handleToolExecutionStart(frame: OmpFrame): void {
  const toolCallId =
    typeof frame.toolCallId === "string" && frame.toolCallId
      ? frame.toolCallId
      : nanoid();
  const toolName =
    typeof frame.toolName === "string" && frame.toolName.length > 0
      ? frame.toolName
      : "unknown";
  const message = ensureAssistantMessage();
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
  flushNow();
}

function handleToolExecutionEnd(frame: OmpFrame): void {
  const toolCallId = frame.toolCallId;
  if (typeof toolCallId !== "string") {
    return;
  }
  const messages = useOmpChatStore.getState().messages;
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
    }
    flushNow();
    return;
  }
}

function handleMessageStart(frame: OmpFrame): void {
  const role =
    typeof frame.message?.role === "string" ? frame.message.role : "assistant";
  // User echoes would duplicate our optimistic local message.
  if (role !== "assistant") {
    return;
  }
  const id =
    typeof frame.message?.id === "string" && frame.message.id
      ? frame.message.id
      : typeof frame.id === "string" && frame.id
        ? frame.id
        : nanoid();
  const messages = useOmpChatStore.getState().messages;
  if (messages.some((m) => m.id === id)) {
    streamingMessageId = id;
    return;
  }
  streamingMessageId = id;
  useOmpChatStore.setState({
    messages: [...messages, { id, role: "assistant", parts: [] }],
  });
}

function handleMessageUpdate(frame: OmpFrame): void {
  const event = frame.assistantMessageEvent;
  if (!event || typeof event.type !== "string") {
    return;
  }
  const delta = typeof event.delta === "string" ? event.delta : "";
  switch (event.type) {
    case "text_delta":
      appendDelta("text", delta);
      break;
    case "thinking_delta":
      appendDelta("reasoning", delta);
      break;
    // Partial tool-call JSON: omp emits tool_execution_start/end with the
    // authoritative toolCallId, toolName and args afterwards, which is where
    // the tool part is materialized.
    case "toolcall_delta":
    default:
      break;
  }
}

function handleResponse(frame: OmpFrame): void {
  if (frame.success !== false) {
    return;
  }
  const description =
    typeof frame.error === "string" && frame.error
      ? frame.error
      : "The omp process rejected the command.";
  toast.error("omp command failed", { description });

  const command = frame.command;
  const commandType =
    typeof command === "string"
      ? command
      : command &&
          typeof command === "object" &&
          typeof (command as { type?: unknown }).type === "string"
        ? (command as { type: string }).type
        : "";
  if (commandType === "prompt") {
    // The run never started; release the input instead of waiting for an
    // agent_end that will not arrive.
    if (useOmpChatStore.getState().status === "busy") {
      useOmpChatStore.setState({ status: "ready" });
    }
  }
}

function handleApprovalRequest(frame: OmpFrame): void {
  const id = typeof frame.id === "string" ? frame.id : "";
  if (!id) {
    return;
  }
  const method: OmpApprovalMethod =
    frame.method === "select" || frame.method === "input"
      ? frame.method
      : "confirm";
  const options = Array.isArray(frame.options)
    ? frame.options.filter((option): option is string => typeof option === "string")
    : [];
  useOmpChatStore.setState({
    pendingApproval: {
      id,
      method,
      title:
        typeof frame.title === "string" && frame.title
          ? frame.title
          : "omp needs your approval",
      options,
    },
  });
}

function finishRun(): void {
  streamingMessageId = null;
  const state = useOmpChatStore.getState();
  const patch: Partial<OmpChatState> = { status: "ready" };
  // A run that ends without its approval being answered leaves the request dead.
  if (state.pendingApproval) {
    patch.pendingApproval = null;
  }
  useOmpChatStore.setState(patch);
  flushNow();
}

function handleFrame(payload: unknown): void {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return;
  }
  const frame = payload as OmpFrame;
  switch (frame.type) {
    case "ready":
    case "session": {
      const patch: Partial<OmpChatState> = {};
      if (frame.type === "ready") {
        const { status } = useOmpChatStore.getState();
        if (status === "connecting" || status === "disconnected") {
          patch.status = "ready";
        }
      }
      const sessionId =
        typeof frame.id === "string" && frame.id
          ? frame.id
          : typeof frame.sessionId === "string" && frame.sessionId
            ? frame.sessionId
            : null;
      if (sessionId) {
        patch.sessionId = sessionId;
      }
      if (Object.keys(patch).length > 0) {
        useOmpChatStore.setState(patch);
      }
      break;
    }
    case "response":
      handleResponse(frame);
      break;
    case "agent_start":
      if (useOmpChatStore.getState().status !== "busy") {
        useOmpChatStore.setState({ status: "busy" });
      }
      break;
    case "message_start":
      handleMessageStart(frame);
      break;
    case "message_update":
      handleMessageUpdate(frame);
      break;
    case "message_end":
      if (
        streamingMessageId !== null &&
        (frame.message?.id === streamingMessageId || frame.id === streamingMessageId)
      ) {
        streamingMessageId = null;
      }
      flushNow();
      break;
    case "tool_execution_start":
      handleToolExecutionStart(frame);
      break;
    case "tool_execution_end":
      handleToolExecutionEnd(frame);
      break;
    case "turn_end":
    case "agent_end":
      finishRun();
      break;
    case "extension_ui_request":
      handleApprovalRequest(frame);
      break;
    default:
      // Unknown frame types are ignored silently.
      break;
  }
}

function handleRpcExit(args: unknown[]): void {
  streamingMessageId = null;
  const detail = args.find(
    (arg): arg is string => typeof arg === "string" && arg.length > 0
  );
  useOmpChatStore.setState({
    status: "disconnected",
    pendingApproval: null,
  });
  flushNow();
  toast.error("omp RPC process exited", {
    description: detail ?? "Start a new session to continue.",
  });
}

export const useOmpChatStore = create<OmpChatState>()((set, get) => ({
  status: "disconnected",
  sessionId: null,
  messages: [],
  pendingApproval: null,

  start: async (cwd = "") => {
    const { status } = get();
    if (status === "connecting" || status === "ready" || status === "busy") {
      return;
    }
    set({ status: "connecting" });
    try {
      await callStartRPC(cwd);
      // "ready" arrives via the omp:frame event.
    } catch (error) {
      set({ status: "disconnected" });
      toast.error("Could not start omp", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  },

  stop: async () => {
    try {
      await callStopRPC();
    } catch (error) {
      toast.error("Could not stop omp", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      streamingMessageId = null;
      set({ status: "disconnected", pendingApproval: null });
    }
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const { status } = get();
    if (status === "busy" || status === "connecting") {
      return;
    }
    if (status === "disconnected") {
      await get().start("");
      // The `ready` frame lands asynchronously after StartRPC resolves —
      // wait for it (or a disconnect) instead of racing the first prompt.
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const next = get().status;
        if (next === "ready") {
          break;
        }
        if (next === "disconnected") {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (get().status !== "ready") {
        return;
      }
    }
    const userMessage: OmpMessage = {
      id: nanoid(),
      role: "user",
      parts: [{ type: "text", text: trimmed }],
    };
    set((state) => ({ messages: [...state.messages, userMessage] }));
    try {
      await callRPCSend(
        JSON.stringify({ id: nanoid(), type: "prompt", message: trimmed })
      );
      set({ status: "busy" });
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== userMessage.id),
      }));
      toast.error("Could not send message", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  },

  abort: async () => {
    if (get().status !== "busy") {
      return;
    }
    try {
      await callRPCSend(JSON.stringify({ id: nanoid(), type: "abort" }));
      // status stays busy until agent_end or the process exit event.
    } catch (error) {
      toast.error("Could not abort", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  },

  respondApproval: async (value) => {
    const approval = get().pendingApproval;
    if (!approval) {
      return;
    }
    set({ pendingApproval: null });
    try {
      await callRPCSend(
        JSON.stringify({
          id: approval.id,
          type: "extension_ui_response",
          value,
        })
      );
    } catch (error) {
      toast.error("Could not respond", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));

let initialized = false;

/** Subscribes the store to the Wails events emitted by the Go RPC bridge. */
export function initOmpStore(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  runtime.EventsOn("omp:frame", (payload: unknown) => handleFrame(payload));
  runtime.EventsOn("omp:rpc-exit", (...args: unknown[]) =>
    handleRpcExit(args)
  );
}

// Wire the events once at module scope — no React lifecycle involved.
void initOmpStore();
