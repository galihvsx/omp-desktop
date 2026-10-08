import { Composer } from "@/components/workspace/composer";
import { ConversationTimeline } from "@/components/workspace/conversation";
import { FrameLog } from "@/components/workspace/frame-log";
import { PermissionDock } from "@/components/workspace/permission-dock";
import { StatusBar } from "@/components/workspace/status-bar";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { initOmpStore } from "@/stores/omp-chat-store";
import { useFrameLogStore } from "@/stores/frame-log-store";

// Subscribe to the omp:frame / omp:rpc-exit events exactly once per window.
// Guarded because the Wails runtime is absent when the frontend is opened in
// a plain browser dev server.
try {
  initOmpStore();
} catch {
  // no Wails runtime (browser-only dev) — frames will not arrive.
}

export default function ChatPage() {
  const toggleFrameLog = useFrameLogStore((state) => state.toggle);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <WorkspaceHeader onToggleFrameLog={toggleFrameLog} />
      <ConversationTimeline />
      <PermissionDock />
      <Composer />
      <FrameLog />
      <StatusBar />
    </div>
  );
}
