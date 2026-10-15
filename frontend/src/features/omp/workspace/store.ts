import { create } from "zustand";

import { callListSessions } from "@/lib/repositories/workspace";
import type { SessionGroup } from "@/lib/repositories/types";
import { useOmpSessionStore } from "@/features/omp/session/store";

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
      set({ loading: true, error: null });
      try {
        const groups = await callListSessions();
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

let lastSignature = "";

useOmpSessionStore.subscribe((state) => {
  const signature = Object.values(state.sessions)
    .map(
      (session) =>
        `${session.key}\u0000${session.sessionFile ?? ""}\u0000${session.status}`
    )
    .join("\n");
  if (signature === lastSignature) {
    return;
  }
  lastSignature = signature;
  void useWorkspaceSessionsStore.getState().refresh();
});
