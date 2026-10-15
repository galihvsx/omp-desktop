import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TerminalPanel } from "@/components/workspace/terminal-panel";
import { useNavigate } from "@/hooks/use-navigate";
import ChatPage from "@/pages/chat";
import NewSessionPage from "@/pages/new-session";
import SettingsPage from "@/pages/settings";
import AppSidebar from "./app-sidebar";
import { Titlebar } from "../title-bar";

export default function DashboardLayout() {
  const { view } = useNavigate();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        {view.name === "conversation" ? (
          <ChatPage />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <header className="flex h-9 shrink-0 items-center justify-between border-b px-2 select-none titlebar">
              <Titlebar />
            </header>
            {view.name === "settings" ? <SettingsPage /> : <NewSessionPage />}
          </div>
        )}
        <TerminalPanel />
      </SidebarInset>
    </SidebarProvider>
  );
}
