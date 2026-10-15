import { bridgeMissingError, getBridge } from "@/lib/bridge";
import type { GitStatus } from "./types";

export async function callListBranches(cwd: string): Promise<string[]> {
  const bridge = getBridge();
  if (!bridge?.ListBranches) {
    throw bridgeMissingError();
  }
  return await bridge.ListBranches(cwd);
}

export async function callGitStatus(cwd: string): Promise<GitStatus> {
  const bridge = getBridge();
  if (!bridge?.GitStatus) {
    throw bridgeMissingError();
  }
  return await bridge.GitStatus(cwd);
}
