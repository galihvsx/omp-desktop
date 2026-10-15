import type * as React from "react";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderSearchIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SessionGroup, SessionSummary } from "@/features/omp";
import { SessionRow } from "./session-row";
import { findLive, type LiveSession } from "./workspace-live";

export interface WorkspaceRowProps {
  group: SessionGroup;
  live: Map<string, LiveSession>;
  activeSessionId: string | null;
  open: boolean;
  onOpenSession: (session: SessionSummary) => void;
  onNewSession: () => void;
  onReveal: () => void;
  onHide: () => void;
}

export function WorkspaceRow({
  group,
  live,
  activeSessionId,
  open,
  onOpenSession,
  onNewSession,
  onReveal,
  onHide,
}: WorkspaceRowProps) {
  const { t, formatRelative } = useTranslation();

  return (
    <SidebarMenuItem className="group/ws">
      <div className="relative flex items-center">
        <CollapsibleTrigger
          className="min-w-0 flex-1"
          render={
            <SidebarMenuButton
              className="text-muted-foreground h-7 px-1.5 text-ui-xs font-medium hover:text-foreground gap-1.5"
              size="sm"
              title={group.path}
            />
          }
        >
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground/70 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{group.name}</span>
          <span className="ml-auto shrink-0 text-ui-xs text-muted-foreground/60 group-hover/ws:opacity-0 transition-opacity">
            {group.updatedMs
              ? formatRelative(Date.now() - group.updatedMs)
              : ""}
          </span>
        </CollapsibleTrigger>
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5 bg-sidebar opacity-0 transition-opacity group-focus-within/ws:opacity-100 group-hover/ws:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100">
          <IconButton
            tone="sidebar"
            label={t("sidebar.newSessionInWorkspace")}
            title={t("sidebar.newSessionInWorkspace")}
            icon={<PlusIcon className="size-3.5" />}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onNewSession();
            }}
          />
          <IconButton
            tone="sidebar"
            label={t("sidebar.revealWorkspace")}
            title={t("sidebar.revealWorkspace")}
            icon={<FolderSearchIcon className="size-3.5" />}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onReveal();
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("sidebar.moreActions")}
              className="data-popup-open:opacity-100"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              render={
                <Button size="icon-xs" variant="ghost" />
              }
            >
              <MoreHorizontalIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onHide}>
                {t("sidebar.hideWorkspace")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CollapsibleContent>
        <SidebarMenu className="gap-0.5 py-0.5">
          {group.sessions.map((session) => {
            const runtime = findLive(live, session);
            return (
              <SessionRow
                key={session.id}
                active={session.id === activeSessionId}
                live={runtime !== null && runtime.status !== "disconnected"}
                busy={runtime?.status === "busy"}
                onOpen={onOpenSession}
                session={session}
              />
            );
          })}
        </SidebarMenu>
      </CollapsibleContent>
    </SidebarMenuItem>
  );
}
