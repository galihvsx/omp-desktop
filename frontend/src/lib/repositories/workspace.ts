import { bridgeMissingError, getBridge } from "@/lib/bridge";
import type { SessionGroup } from "./types";

export async function callListSessions(): Promise<SessionGroup[]> {
  const bridge = getBridge();
  if (!bridge?.ListSessions) {
    throw bridgeMissingError();
  }
  return await bridge.ListSessions();
}

export async function callPickWorkspaceFolder(): Promise<string> {
  const bridge = getBridge();
  if (!bridge?.PickWorkspaceFolder) {
    throw bridgeMissingError();
  }
  return await bridge.PickWorkspaceFolder();
}

export async function callRevealPath(path: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.RevealPath) {
    throw bridgeMissingError();
  }
  await bridge.RevealPath(path);
}
