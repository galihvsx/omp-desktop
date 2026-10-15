import { bridgeMissingError, getBridge } from "@/lib/bridge";

export async function callTerminalStart(id: string, cols: number, rows: number): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StartTerminal) {
    throw bridgeMissingError();
  }
  await bridge.StartTerminal(id, cols, rows);
}

export async function callTerminalShellName(id: string): Promise<string> {
  const bridge = getBridge();
  if (!bridge?.TerminalShellName) {
    throw bridgeMissingError();
  }
  return await bridge.TerminalShellName(id);
}

export async function callTerminalWrite(id: string, data: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.TerminalWrite) {
    throw bridgeMissingError();
  }
  await bridge.TerminalWrite(id, data);
}

export async function callTerminalResize(id: string, cols: number, rows: number): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.TerminalResize) {
    throw bridgeMissingError();
  }
  await bridge.TerminalResize(id, cols, rows);
}

export async function callTerminalStop(id: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StopTerminal) {
    throw bridgeMissingError();
  }
  await bridge.StopTerminal(id);
}

export async function callStopAllTerminals(): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StopAllTerminals) {
    throw bridgeMissingError();
  }
  await bridge.StopAllTerminals();
}
