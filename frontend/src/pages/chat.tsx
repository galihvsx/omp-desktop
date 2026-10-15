import { Composer } from "@/components/workspace/composer";
import { ConversationTimeline } from "@/components/workspace/conversation";
import { PermissionDock } from "@/components/workspace/permission-dock";
import { SessionConflictBanner } from "@/components/workspace/session-conflict-banner";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import NewSessionPage from "@/pages/new-session";
import { initOmpStore, useOmpSession, useOmpTerminal } from "@/features/omp";

initOmpStore();

export default function ChatPage() {
  const { toggle: toggleTerminal } = useOmpTerminal();
  const runtime = useOmpSession();

  if (!runtime) {
    return <NewSessionPage />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <WorkspaceHeader onToggleTerminal={toggleTerminal} />
      <SessionConflictBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <ConversationTimeline />
        <WorkspacePanel />
      </div>
      <PermissionDock />
      <Composer />
    </div>
  );
}
