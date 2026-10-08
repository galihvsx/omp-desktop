import { SquareTerminal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFrameLogStore } from "@/stores/frame-log-store";

export function FrameLog() {
  const open = useFrameLogStore((state) => state.open);
  const frames = useFrameLogStore((state) => state.frames);
  const setOpen = useFrameLogStore((state) => state.setOpen);
  const clear = useFrameLogStore((state) => state.clear);

  if (!open) {
    return null;
  }

  return (
    <section className="shrink-0 border-t bg-card">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <SquareTerminal className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-ui-sm font-medium">Frame log</span>
        <Badge variant="secondary">{frames.length}</Badge>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={clear}>
          Bersihkan
        </Button>
        <Button
          aria-label="Tutup frame log"
          size="icon"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-ui-xs leading-relaxed text-muted-foreground">
        {frames.length === 0 ? "Belum ada frame." : frames.join("\n")}
      </pre>
    </section>
  );
}
