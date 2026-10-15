import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  useOmpActiveKey,
  useOmpSessionActions,
  useOmpSessions,
  useOmpWorkspace,
  useRevealPath,
  type SessionSummary,
} from "@/features/omp";
import { useNavigate } from "@/hooks/use-navigate";
import { useTranslation } from "@/lib/i18n";

import { decodeLive, findLive, liveSignature } from "./workspace-live";
import { WorkspaceRow } from "./workspace-row";
import { WorkspaceHeader } from "./workspace-header";
import {
  readStoredExpandedGroups,
  readStoredHiddenWorkspaces,
  writeStoredExpandedGroups,
  writeStoredHiddenWorkspaces,
} from "./workspace-storage";

export function NavWorkspace() {
  const { t } = useTranslation();
  const { groups, loading, loaded, error, refresh } = useOmpWorkspace();

  const navigate = useNavigate((state) => state.navigate);
  const { open } = useOmpSessionActions();
  const activeKey = useOmpActiveKey();
  const sessions = useOmpSessions();
  const live = useMemo(() => decodeLive(liveSignature(sessions)), [sessions]);
  const revealPath = useRevealPath();
  const activeRuntime = activeKey ? (live.get(activeKey) ?? null) : null;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    readStoredExpandedGroups,
  );

  const setGroupExpanded = (path: string, next: boolean) => {
    setExpandedGroups((previous) => {
      const updated = { ...previous, [path]: next };
      writeStoredExpandedGroups(updated);
      return updated;
    });
  };

  const [hiddenPaths, setHiddenPaths] = useState<string[]>(
    readStoredHiddenWorkspaces,
  );

  const hideWorkspace = (path: string) => {
    setHiddenPaths((previous) => {
      const updated = previous.includes(path) ? previous : [...previous, path];
      writeStoredHiddenWorkspaces(updated);
      return updated;
    });
  };

  const showHidden = () => {
    setHiddenPaths((previous) => {
      if (previous.length === 0) {
        return previous;
      }
      writeStoredHiddenWorkspaces([]);
      return [];
    });
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyReady = [...live.values()].some(
    (session) => session.status === "ready",
  );
  useEffect(() => {
    if (!anyReady) {
      return;
    }
    const timer = window.setTimeout(() => void refresh(), 1500);
    return () => window.clearTimeout(timer);
  }, [anyReady, refresh]);

  const openSession = (session: SessionSummary) => {
    void open({
      key: session.id,
      sessionFile: session.path,
      cwd: session.cwd,
      title: session.title,
    }).then(() => navigate({ name: "conversation", key: session.id }));
  };

  const hiddenSet = new Set(hiddenPaths);
  const hiddenCount = groups.reduce(
    (count, group) => (hiddenSet.has(group.path) ? count + 1 : count),
    0,
  );

  const startSessionIn = (path: string) => {
    navigate({ name: "new-session", cwd: path });
  };

  const revealWorkspace = (path: string) => {
    void revealPath(path);
  };

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden pt-2">
      <WorkspaceHeader loading={loading} onRefresh={() => void refresh()} />
      <SidebarMenu className="gap-0.5">
        {groups
          .filter((group) => !hiddenSet.has(group.path))
          .map((group) => {
            const activeSession = activeRuntime
              ? group.sessions.find(
                (session) => findLive(live, session) === activeRuntime,
              )
              : undefined;
            const open =
              expandedGroups[group.path] ?? activeSession !== undefined;
            return (
              <Collapsible
                key={group.path}
                className="group/collapsible"
                open={open}
                onOpenChange={(next: boolean) =>
                  setGroupExpanded(group.path, next)
                }
              >
                <WorkspaceRow
                  group={group}
                  live={live}
                  activeSessionId={activeSession?.id ?? null}
                  open={open}
                  onOpenSession={openSession}
                  onNewSession={() => startSessionIn(group.path)}
                  onReveal={() => revealWorkspace(group.path)}
                  onHide={() => hideWorkspace(group.path)}
                />
              </Collapsible>
            );
          })}
        {hiddenCount > 0 && (
          <SidebarMenuItem>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-left"
              onClick={showHidden}
              type="button"
            >
              {t("sidebar.hidden", { count: hiddenCount })}
            </Button>
          </SidebarMenuItem>
        )}
        {groups.length === 0 && (
          <SidebarMenuItem>
            <span className="px-2 py-1 text-ui-xs text-muted-foreground">
              {!loaded
                ? t("sidebar.loadingSessions")
                : error
                  ? error
                  : t("sidebar.emptySessions")}
            </span>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export default NavWorkspace;
