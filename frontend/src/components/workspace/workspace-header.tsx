import { SquareTerminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOmpChatStore } from "@/stores/omp-chat-store";

const STATUS_LABEL: Record<string, string> = {
  disconnected: "Terputus",
  connecting: "Menjalankan omp…",
  ready: "Siap",
  busy: "omp sedang bekerja…",
};

const STATUS_DOT: Record<string, string> = {
  disconnected: "bg-muted-foreground/50",
  connecting: "bg-chart-2 animate-pulse",
  ready: "bg-primary",
  busy: "bg-primary animate-pulse",
};

export function WorkspaceHeader({
  onToggleFrameLog,
}: {
  onToggleFrameLog?: () => void;
}) {
  const status = useOmpChatStore((state) => state.status);
  const sessionId = useOmpChatStore((state) => state.sessionId);
  const start = useOmpChatStore((state) => state.start);
  const stop = useOmpChatStore((state) => state.stop);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b px-3">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
      />
      <span className="text-ui-sm text-muted-foreground">
        {STATUS_LABEL[status]}
      </span>
      {sessionId ? (
        <span className="max-w-[12rem] truncate rounded-md border px-1.5 py-0.5 font-mono text-ui-xs text-muted-foreground">
          {sessionId}
        </span>
      ) : null}

      <span className="flex-1" />

      {status === "disconnected" ? (
        <Button size="sm" variant="outline" onClick={() => void start()}>
          Mulai sesi
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => void stop()}>
          Hentikan
        </Button>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Frame log"
                size="icon"
                variant="ghost"
                onClick={onToggleFrameLog}
              />
            }
          >
            <SquareTerminal className="size-4" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Frame log</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>
  );
}
