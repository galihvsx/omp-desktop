import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Edit2Icon,
  FileTextIcon,
  FolderIcon,
  MoreHorizontalIcon,
  Settings2Icon,
  TerminalSquareIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChipTrigger } from "@/components/ui/chip-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MonoValue } from "@/components/ui/mono-value";
import { useOmpSession, useOmpSessionActions } from "@/features/omp";
import { useNavigate } from "@/hooks/use-navigate";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { WindowControls } from "@/components/title-bar";

export function WorkspaceHeader({
  onToggleTerminal,
}: {
  onToggleTerminal?: () => void;
}) {
  const runtime = useOmpSession();
  const { t } = useTranslation();
  const { history, back, navigate } = useNavigate();
  const stop = useOmpSessionActions().stop;
  const status = runtime?.status ?? "disconnected";
  const isRpcLive = status === "ready" || status === "busy";

  const title = runtime?.title || t("sidebar.newSession");

  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b px-2 select-none titlebar bg-background">
      <div
        className="flex items-center gap-1.5 min-w-0"
        style={{ ["--wails-draggable" as string]: "no-drag" }}
      >
        <Button
          onClick={back}
          disabled={history.length === 0}
          size="icon-sm"
          variant="ghost"
          className="disabled:opacity-30"
          title="Back"
        >
          <ChevronLeftIcon className="size-3.5" />
        </Button>
        <Button
          disabled
          size="icon-sm"
          variant="ghost"
          className="disabled:opacity-30"
          title="Forward"
        >
          <ChevronRightIcon className="size-3.5" />
        </Button>

        <ChipTrigger
          tone="header"
          chevron="none"
          className="bg-transparent border-0 border-none"
          icon={<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />}
          label={
            <span className="text-ellipsis w-42 overflow-hidden text-sm text-ui-xs leading-none ml-1">
              {title}
            </span>
          }
          // trailing={
          //   <MonoValue className="inline-flex items-center gap-1 rounded bg-transparent border-0 border-none px-1 py-0.5 shrink-0">
          //     <span
          //       className={cn(
          //         "size-1.5 rounded-full shrink-0",
          //         isRpcLive ? "bg-chart-2" : "bg-muted-foreground/40",
          //       )}
          //     />
          //     rpc
          //   </MonoValue>
          // }
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0"
                aria-label="Session options"
              />
            }
          >
            <MoreHorizontalIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max p-2 px-2">
            <DropdownMenuItem
              onClick={() => {
                const newTitle = window.prompt("Rename session:", title);
                if (newTitle && runtime) {
                  runtime.title = newTitle;
                }
              }}
            >
              <Edit2Icon />
              Rename session
            </DropdownMenuItem>
            {onToggleTerminal && (
              <DropdownMenuItem onClick={onToggleTerminal}>
                <TerminalSquareIcon />
                {t("terminal.title")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate({ name: "settings" })}>
              <Settings2Icon />
              {t("sidebar.settings")}
            </DropdownMenuItem>
            {runtime && status !== "disconnected" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void stop(runtime.key)}
                >
                  {t("common.stop")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 h-full min-w-4" />

      <WindowControls />
    </header>
  );
}