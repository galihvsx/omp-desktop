import { useCallback } from "react";
import { enableAgentFrames, usePanelAgents, usePanelStore } from "./store";
export { usePanelAgents };
export type { PanelAgent } from "./store";

export function usePanel() {
  const collapsed = usePanelStore((s) => s.collapsed);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const setCollapsed = usePanelStore((s) => s.setCollapsed);
  return { collapsed, toggleCollapsed, setCollapsed };
}

export function useEnableAgentFrames(): (key: string) => Promise<void> {
  return useCallback((key: string) => enableAgentFrames(key), []);
}
