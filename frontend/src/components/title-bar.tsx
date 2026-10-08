import { CopyIcon, SquareIcon, XIcon } from "lucide-react";
import { useTitlebar } from "@/hooks/use-titlebar";
import { Button } from "./ui/button";

export function Titlebar() {
  const { isMaximized, toggleMaximized, minimize, quit } = useTitlebar();

  return (
    <div className="flex w-full px-2 h-full items-center justify-between select-none titlebar">
      <div className="flex items-center gap-2 px-3">
        {/* logo / judul / tombol tab dll — tetap draggable */}
      </div>

      {/* window controls — harus no-drag biar bisa diklik */}
      <div
        className="flex h-min gap-1"
        style={{ ["--wails-draggable" as string]: "no-drag" }}
      >
        <Button onClick={minimize} size="icon-sm" variant="ghost">
          ─
        </Button>
        <Button onClick={toggleMaximized} size="icon-sm" variant="ghost">
          {isMaximized ? <CopyIcon /> : <SquareIcon />}
        </Button>
        <Button onClick={quit} size="icon-sm" variant="ghost">
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
