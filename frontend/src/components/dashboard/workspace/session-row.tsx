import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";
import type { SessionSummary } from "@/features/omp";
import { PinIcon } from "lucide-react";

export interface SessionRowProps {
  session: SessionSummary;
  active: boolean;
  live: boolean;
  busy: boolean;
  onOpen: (session: SessionSummary) => void;
}

export function SessionRow({
  session,
  active,
  live,
  busy,
  onOpen,
}: SessionRowProps) {
  const { t, formatRelative } = useTranslation();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        isActive={active}
        tooltip={session.cwd}
        onClick={() => onOpen(session)}
      >
        <span className="flex items-center justify-center shrink-0">
          {busy ? (
            <Spinner className="size-3" />
          ) : live ? (
            <span className="size-1.5 rounded-full bg-chart-2" />
          ) : null}
        </span>
        <span className="truncate text-ui-xs">
          {session.title || t("common.untitledSession")}
        </span>
        <span className="ml-auto shrink-0 text-ui-sm text-muted-foreground/70 font-mono">
          {session.updatedMs
            ? formatRelative(Date.now() - session.updatedMs)
            : ""}
        </span>
      </SidebarMenuButton>
      {!busy && !live ? (
        <SidebarMenuAction showOnHover>
          <PinIcon />
        </SidebarMenuAction>
      ) : null}
    </SidebarMenuItem>
  );
}
