import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  SquareIcon,
  SquareTerminalIcon,
  XIcon,
} from "lucide-react";
import { useTitlebar } from "@/hooks/use-titlebar";
import { useNavigate } from "@/hooks/use-navigate";
import { Button } from "./ui/button";

export function WindowControls() {
  const { isMaximized, toggleMaximized, minimize, quit } = useTitlebar();

  return (
    <div
      className="flex h-min gap-0.5 items-center"
      style={{ ["--wails-draggable" as string]: "no-drag" }}
    >
      <Button
        onClick={minimize}
        size="icon-xs"
        variant="ghost"
        title="Minimize"
      >
        ─
      </Button>
      <Button
        onClick={toggleMaximized}
        size="icon-xs"
        variant="ghost"
        title="Maximize"
      >
        {isMaximized ? (
          <CopyIcon className="size-3" />
        ) : (
          <SquareIcon className="size-3" />
        )}
      </Button>
      <Button
        onClick={quit}
        size="icon-xs"
        variant="destructive"
        title="Close"
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
}

export function Titlebar() {
  const { history, back } = useNavigate();

  return (
    <div className="flex w-full h-full items-center justify-between select-none titlebar">
      <div
        className="flex items-center gap-1"
        style={{ ["--wails-draggable" as string]: "no-drag" }}
      >
        <Button
          onClick={back}
          disabled={history.length === 0}
          size="icon-xs"
          variant="ghost"
          className="disabled:opacity-30"
          title="Back"
        >
          <ChevronLeftIcon className="size-3.5" />
        </Button>
        <Button
          disabled
          size="icon-xs"
          variant="ghost"
          className="disabled:opacity-30"
          title="Forward"
        >
          <ChevronRightIcon className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 h-full min-w-4" />

      <div className="flex mx-2 bg-muted/40 px-2 rounded-md items-center gap-1.5 text-muted-foreground">
        <SquareTerminalIcon className="size-4.5" />
      </div>
      <WindowControls />
    </div>
  );
}
