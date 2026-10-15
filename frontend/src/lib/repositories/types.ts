
export interface StartOptions {
  cwd: string;
  resume?: string;
  model?: string;
  thinkingLevel?: string;
  approvalMode?: string;
}

export interface ModelOption {
  provider: string;
  id: string;
  selector: string;
  name: string;
  reasoning: boolean;
  thinking: string[];
  contextWindow: number;
}

export interface AgentContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  [key: string]: unknown;
}

export interface AgentMessage {
  role: string;
  content?: AgentContentBlock[] | string;
  timestamp?: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  [key: string]: unknown;
}

export interface SessionTranscript {
  id: string;
  title: string;
  cwd: string;
  created: number;
  updated: number;
  messages: AgentMessage[];
}

export interface SessionPage {
  messages: AgentMessage[];
  total: number;
  start: number;
  hasMore: boolean;
}

export interface SessionSummary {
  id: string;
  path: string;
  title: string;
  cwd: string;
  createdMs: number;
  updatedMs: number;
}

export interface SessionGroup {
  path: string;
  name: string;
  updatedMs: number;
  sessions: SessionSummary[];
}

export interface SessionInUse {
  inUse: boolean;
  updatedAgeMs: number;
  reason: string;
}

export interface GitStatus {
  branch: string;
  changed: number;
  insertions: number;
  deletions: number;
}
