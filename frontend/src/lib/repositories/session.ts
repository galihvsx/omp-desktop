import { bridgeMissingError, getBridge } from "@/lib/bridge";
import type {
  SessionInUse,
  SessionPage,
  SessionTranscript,
  StartOptions,
} from "./types";

export async function callStartSession(
  key: string,
  opts: StartOptions
): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StartSession) {
    throw bridgeMissingError();
  }
  await bridge.StartSession(key, opts);
}

export async function callSendSession(
  key: string,
  command: string
): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.SendSession) {
    throw bridgeMissingError();
  }
  await bridge.SendSession(key, command);
}

export async function callStopSession(key: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StopSession) {
    throw bridgeMissingError();
  }
  await bridge.StopSession(key);
}

export async function callStopAllSessions(): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StopAllSessions) {
    throw bridgeMissingError();
  }
  await bridge.StopAllSessions();
}

export async function callListRunningSessions(): Promise<string[]> {
  const bridge = getBridge();
  if (!bridge?.ListRunningSessions) {
    throw bridgeMissingError();
  }
  return await bridge.ListRunningSessions();
}

export async function callCheckSessionInUse(
  sessionFile: string
): Promise<SessionInUse> {
  const bridge = getBridge();
  if (!bridge?.CheckSessionInUse) {
    throw bridgeMissingError();
  }
  return await bridge.CheckSessionInUse(sessionFile);
}

export async function callReadSession(
  path: string
): Promise<SessionTranscript> {
  const bridge = getBridge();
  if (!bridge?.ReadSession) {
    throw bridgeMissingError();
  }
  return await bridge.ReadSession(path);
}

export async function callReadSessionPage(
  path: string,
  before: number,
  limit?: number
): Promise<SessionPage> {
  const bridge = getBridge();
  if (!bridge?.ReadSessionPage) {
    throw bridgeMissingError();
  }
  return await bridge.ReadSessionPage(path, before, limit ?? 0);
}
