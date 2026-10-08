import { create } from "zustand";

import { useOmpChatStore } from "@/stores/omp-chat-store";

/** One omp session as returned by the Go `ListSessions` binding. */
export interface SessionSummary {
  id: string;
  title: string;
  cwd: string;
  createdMs: number;
  updatedMs: number;
}

/** Sessions that ran in one working directory. */
export interface SessionGroup {
  path: string;
  name: string;
  updatedMs: number;
  sessions: SessionSummary[];
}

/** Surface of the bound Go `App` struct this store depends on. */
type SessionsBridge = {
  ListSessions?: () => Promise<SessionGroup[]>;
};

function getBridge(): SessionsBridge | null {
  const w = window as unknown as {
    go?: { main?: { App?: SessionsBridge } };
  };
  return w.go?.main?.App ?? null;
}

export interface WorkspaceSessionsState {
  groups: SessionGroup[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useWorkspaceSessionsStore = create<WorkspaceSessionsState>(
  (set, get) => ({
    groups: [],
    loading: false,
    loaded: false,
    error: null,
    refresh: async () => {
      if (get().loading) {
        return;
      }
      const bridge = getBridge();
      if (!bridge?.ListSessions) {
        set({
          error: "Jembatan Wails tidak tersedia (jalankan lewat `wails dev`).",
          loaded: true,
        });
        return;
      }
      set({ loading: true, error: null });
      try {
        const groups = await bridge.ListSessions();
        set({ groups, loading: false, loaded: true });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : String(error),
          loading: false,
          loaded: true,
        });
      }
    },
  })
);

// Keep the list fresh across the session lifecycle. A start/stop changes the
// live sessionId, and the on-disk store changes with it — but the child writes
// its session header asynchronously, so a status transition re-reads too.
useOmpChatStore.subscribe((state, previous) => {
  if (
    state.sessionId !== previous.sessionId ||
    state.status !== previous.status
  ) {
    void useWorkspaceSessionsStore.getState().refresh();
  }
});
