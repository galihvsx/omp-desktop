import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceSessionsStore } from "./store";
import { callGitStatus, callListBranches } from "@/lib/repositories/git";
import { callRevealPath } from "@/lib/repositories/workspace";
import type { GitStatus } from "@/lib/repositories/types";
import { useTranslation } from "@/lib/i18n";

export function useOmpWorkspace() {
  const groups = useWorkspaceSessionsStore((s) => s.groups);
  const loading = useWorkspaceSessionsStore((s) => s.loading);
  const loaded = useWorkspaceSessionsStore((s) => s.loaded);
  const error = useWorkspaceSessionsStore((s) => s.error);
  const refresh = useWorkspaceSessionsStore((s) => s.refresh);
  return { groups, loading, loaded, error, refresh };
}

export function useGitStatus(cwd: string, reloadKey?: unknown) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!cwd) { setStatus(null); return; }
    let cancelled = false;
    void callGitStatus(cwd)
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [cwd, reloadKey, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { status, reload };
}

export function useBranches(cwd: string): {
  branches: string[];
  loading: boolean;
} {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!cwd) {
      setBranches([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void callListBranches(cwd)
      .then((next) => {
        if (!cancelled) setBranches(next);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cwd]);
  return { branches, loading };
}

export function useRevealPath(): (path: string) => Promise<void> {
  const { t } = useTranslation();
  return useCallback(
    (path: string) =>
      callRevealPath(path).catch((error: unknown) => {
        toast.error(t("common.commandFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }),
    [t],
  );
}
