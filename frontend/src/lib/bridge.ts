import { t } from "@/lib/i18n";
import type {
  GitStatus,
  ModelOption,
  SessionGroup,
  SessionInUse,
  SessionPage,
  SessionTranscript,
  StartOptions,
} from "@/lib/repositories/types";

export interface WailsOmpAppBridge {
  StartSession(key: string, opts: StartOptions): Promise<void>;
  SendSession(key: string, command: string): Promise<void>;
  StopSession(key: string): Promise<void>;
  StopAllSessions(): Promise<void>;
  ListRunningSessions(): Promise<string[]>;
  CheckSessionInUse(sessionFile: string): Promise<SessionInUse>;
  ReadSession(path: string): Promise<SessionTranscript>;
  ReadSessionPage(path: string, before: number, limit: number): Promise<SessionPage>;
  ListBranches(cwd: string): Promise<string[]>;
  GitStatus(cwd: string): Promise<GitStatus>;
  ListModels(): Promise<ModelOption[]>;
  ListSessions(): Promise<SessionGroup[]>;
  PickWorkspaceFolder(): Promise<string>;
  RevealPath(path: string): Promise<void>;
  StartTerminal(id: string, cols: number, rows: number): Promise<void>;
  TerminalShellName(id: string): Promise<string>;
  TerminalWrite(id: string, data: string): Promise<void>;
  TerminalResize(id: string, cols: number, rows: number): Promise<void>;
  StopTerminal(id: string): Promise<void>;
  StopAllTerminals(): Promise<void>;
}

declare global {
  interface Window {
    go?: { main?: { App?: WailsOmpAppBridge } };
  }
}

export function getBridge(): WailsOmpAppBridge | null {
  return window.go?.main?.App ?? null;
}

export function bridgeMissingError(): Error {
  return new Error(t("common.bridgeUnavailable"));
}
