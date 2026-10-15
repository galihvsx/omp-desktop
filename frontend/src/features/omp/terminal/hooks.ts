import { useCallback } from "react";
import { useTerminalStore } from "./store";
import {
  callTerminalResize, callTerminalShellName, callTerminalStart,
  callTerminalStop, callTerminalWrite,
} from "@/lib/repositories/terminal";
export { attachTerminalWriter, TERMINAL_DEFAULT_DVH, TERMINAL_MAX_DVH, TERMINAL_MIN_DVH } from "./store";
export type { TerminalTab } from "./store";

export function useOmpTerminal() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeId = useTerminalStore((s) => s.activeId);
  const height = useTerminalStore((s) => s.height);
  const toggle = useTerminalStore((s) => s.toggle);
  const openTab = useTerminalStore((s) => s.openTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const closeAll = useTerminalStore((s) => s.closeAll);
  const setActive = useTerminalStore((s) => s.setActive);
  const setHeight = useTerminalStore((s) => s.setHeight);
  const setShellName = useTerminalStore((s) => s.setShellName);
  const clearExited = useTerminalStore((s) => s.clearExited);
  return { tabs, activeId, height, toggle, openTab, closeTab, closeAll, setActive, setHeight, setShellName, clearExited };
}

const terminalActions = {
  start: callTerminalStart,
  write: callTerminalWrite,
  resize: callTerminalResize,
  stop: callTerminalStop,
  shellName: callTerminalShellName,
};
export type TerminalActions = typeof terminalActions;
export function useTerminalActions(): TerminalActions {
  return terminalActions;
}
