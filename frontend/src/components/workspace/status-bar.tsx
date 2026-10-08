import { useFrameLogStore } from "@/stores/frame-log-store";
import { useOmpChatStore } from "@/stores/omp-chat-store";

const STATUS_WORD: Record<string, string> = {
  disconnected: "terputus",
  connecting: "menghubungkan",
  ready: "siap",
  busy: "bekerja",
};

export function StatusBar() {
  const status = useOmpChatStore((state) => state.status);
  const sessionId = useOmpChatStore((state) => state.sessionId);
  const frames = useFrameLogStore((state) => state.frames);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t bg-muted/40 px-3 font-mono text-ui-xs text-muted-foreground">
      <span>{STATUS_WORD[status]}</span>
      <span>{sessionId ? sessionId.slice(0, 8) : "sesi —"}</span>
      <span>frame {frames.length}</span>
      <span className="ml-auto">omp rpc v1</span>
    </footer>
  );
}
