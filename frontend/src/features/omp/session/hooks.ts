import { useOmpSessionStore } from "./store";
import type { SessionRuntime } from "./store";

export function readActiveOmpSession(): SessionRuntime | null {
  const state = useOmpSessionStore.getState();
  return state.activeKey ? state.sessions[state.activeKey] ?? null : null;
}

export function readHasEarlier(): boolean {
  return useOmpSessionStore.getState().hasEarlier();
}

export function useOmpSession(): SessionRuntime | null {
  return useOmpSessionStore((s) => (s.activeKey ? s.sessions[s.activeKey] ?? null : null));
}

export function useOmpSessionByKey(key: string | null): SessionRuntime | null {
  return useOmpSessionStore((s) => (key ? s.sessions[key] ?? null : null));
}

export function useOmpActiveKey(): string | null {
  return useOmpSessionStore((s) => s.activeKey);
}

export function useOmpHasEarlier(): boolean {
  return useOmpSessionStore((s) => s.hasEarlier());
}

export function useOmpSessions(): Record<string, SessionRuntime> {
  return useOmpSessionStore((s) => s.sessions);
}

const sessionActions = (() => {
  const s = useOmpSessionStore.getState();
  return {
    open: s.open, setActive: s.setActive, close: s.close, stop: s.stop,
    send: s.send, queueMessage: s.queueMessage, steerQueued: s.steerQueued,
    removeQueued: s.removeQueued, reorderQueued: s.reorderQueued,
    setInterruptMode: s.setInterruptMode, setSteeringMode: s.setSteeringMode,
    setFollowUpMode: s.setFollowUpMode, abort: s.abort,
    respondApproval: s.respondApproval, setModel: s.setModel,
    setThinkingLevel: s.setThinkingLevel, stopAll: s.stopAll,
    loadEarlier: s.loadEarlier, hasEarlier: s.hasEarlier,
  };
})();
export type OmpSessionActions = typeof sessionActions;
export function useOmpSessionActions(): OmpSessionActions {
  return sessionActions;
}
