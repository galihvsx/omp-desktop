import { RefreshCwIcon } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { SidebarGroupLabel } from "@/components/ui/sidebar";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface WorkspaceHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export function WorkspaceHeader({ loading, onRefresh }: WorkspaceHeaderProps) {
  const { t } = useTranslation();

  return (
    <SidebarGroupLabel className="flex items-center justify-between px-2 text-ui-sm font-semibold tracking-wider text-muted-foreground/70">
      <span>{t("sidebar.projects")}</span>
      <IconButton
        tone="plain"
        label={t("sidebar.refresh")}
        className="text-muted-foreground/70"
        title={t("sidebar.refresh")}
        icon={<RefreshCwIcon className={cn("size-3", loading && "animate-spin")} />}
        onClick={onRefresh}
      />
    </SidebarGroupLabel>
  );
}
