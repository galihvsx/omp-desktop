import { FolderOpenIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
 Collapsible,
 CollapsibleContent,
 CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
 SidebarGroup,
 SidebarGroupLabel,
 SidebarMenu,
 SidebarMenuButton,
 SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useOmpChatStore } from "@/stores/omp-chat-store";
import {
 useWorkspaceSessionsStore,
 type SessionSummary,
} from "@/stores/workspace-sessions-store";

export type NavWorkspaceItem = {
 id: string;
 title: string;
 updatedMs: number;
};

const EXPANDED_STORAGE_KEY = "omp-nav-expanded-groups";

/** Stored group expansion, validated defensively (localStorage is user-editable). */
function readStoredExpandedGroups(): Record<string, boolean> {
 try {
  const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
  if (!raw) {
   return {};
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
   return {};
  }
  const stored: Record<string, boolean> = {};
  for (const [path, value] of Object.entries(parsed)) {
   if (typeof value === "boolean") {
    stored[path] = value;
   }
  }
  return stored;
 } catch {
  return {};
 }
}

function writeStoredExpandedGroups(groups: Record<string, boolean>): void {
 try {
  window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(groups));
 } catch {
  // Storage unavailable (private mode, quota): expansion just won't persist.
 }
}

/** Compact relative time in the ZCode style: 8m, 13h, 2d. */
function formatRelative(ms: number): string {
 if (!ms) {
  return "";
 }
 const diff = Date.now() - ms;
 const minute = 60_000;
 const hour = 60 * minute;
 const day = 24 * hour;
 if (diff < minute) {
  return "baru";
 }
 if (diff < hour) {
  return `${Math.floor(diff / minute)}m`;
 }
 if (diff < day) {
  return `${Math.floor(diff / hour)}h`;
 }
 if (diff < 7 * day) {
  return `${Math.floor(diff / day)}d`;
 }
 const date = new Date(ms);
 return `${String(date.getDate()).padStart(2, "0")}/${String(
  date.getMonth() + 1
 ).padStart(2, "0")}`;
}

function SessionRow({
 session,
 active,
 busy,
}: {
 session: SessionSummary;
 active: boolean;
 busy: boolean;
}) {
 return (
  <SidebarMenuItem>
   <SidebarMenuButton
    size="sm"
    isActive={active}
    className="h-7 gap-1.5 pl-6"
    tooltip={session.cwd}
   >
    {active ? (
     <span
      className={cn(
       "size-1.5 shrink-0 rounded-full bg-chart-2",
       busy && "animate-pulse"
      )}
     />
    ) : (
     <span className="size-1.5 shrink-0" />
    )}
    <span className="truncate text-ui-xs">{session.title}</span>
    <span className="ml-auto shrink-0 text-ui-xs text-muted-foreground">
     {formatRelative(session.updatedMs)}
    </span>
   </SidebarMenuButton>
  </SidebarMenuItem>
 );
}

/**
 * Sessions grouped by their working directory (ZCode-style project list).
 * Data comes from the Go `ListSessions` binding; the real cwd is read from
 * each session file, never decoded from the on-disk directory name.
 */
export default function NavWorkspace() {
 const groups = useWorkspaceSessionsStore((state) => state.groups);
 const loading = useWorkspaceSessionsStore((state) => state.loading);
 const loaded = useWorkspaceSessionsStore((state) => state.loaded);
 const error = useWorkspaceSessionsStore((state) => state.error);
 const refresh = useWorkspaceSessionsStore((state) => state.refresh);

 const sessionId = useOmpChatStore((state) => state.sessionId);
 const status = useOmpChatStore((state) => state.status);

 // Expanded groups survive a hard refresh. A group with the live session
 // opens by default until the user stores an explicit choice for it.
 const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
  readStoredExpandedGroups
 );

 const setGroupExpanded = (path: string, next: boolean) => {
  setExpandedGroups((previous) => {
   const updated = { ...previous, [path]: next };
   writeStoredExpandedGroups(updated);
   return updated;
  });
 };

 useEffect(() => {
  void refresh();
 }, [refresh]);

 // The child writes its session header a moment after `ready`, so one
 // delayed sweep keeps a freshly started session from missing the list.
 useEffect(() => {
  if (status !== "ready") {
   return;
  }
  const timer = window.setTimeout(() => void refresh(), 1500);
  return () => window.clearTimeout(timer);
 }, [refresh, status]);

 return (
  <SidebarGroup className="group-data-[collapsible=icon]:hidden">
   <SidebarGroupLabel className="flex items-center justify-between pr-1">
    Projects
    <button
     aria-label="Muat ulang daftar sesi"
     className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
     onClick={() => void refresh()}
     type="button"
    >
     <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
    </button>
   </SidebarGroupLabel>
   <SidebarMenu>
    {groups.map((group) => {
     const open =
      expandedGroups[group.path] ??
      group.sessions.some((s) => s.id === sessionId);
     return (
      <Collapsible
       key={group.path}
       className="group/collapsible"
       open={open}
       onOpenChange={(next: boolean) => setGroupExpanded(group.path, next)}
      >
       <SidebarMenuItem>
        <CollapsibleTrigger
         className="min-w-full"
         render={
          <SidebarMenuButton
           className="text-muted-foreground"
           size="sm"
           title={group.path}
          />
         }
        >
         <FolderOpenIcon />
         <span className="truncate">{group.name}</span>
         <span className="ml-auto shrink-0 text-ui-xs">
          {formatRelative(group.updatedMs)}
         </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
         <SidebarMenu>
          {group.sessions.map((session) => (
           <SessionRow
            key={session.id}
            active={session.id === sessionId}
            busy={status === "busy"}
            session={session}
           />
          ))}
         </SidebarMenu>
        </CollapsibleContent>
       </SidebarMenuItem>
      </Collapsible>
     );
    })}
    {groups.length === 0 && (
     <SidebarMenuItem>
      <span className="px-2 py-1 text-ui-xs text-muted-foreground">
       {!loaded
        ? "Memuat sesi…"
        : error
         ? error
         : "Belum ada sesi tersimpan."}
      </span>
     </SidebarMenuItem>
    )}
   </SidebarMenu>
  </SidebarGroup>
 );
}
