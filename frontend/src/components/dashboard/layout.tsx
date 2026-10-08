import { ReactNode } from "react";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider
} from "@/components/ui/sidebar";
import { useNavigate } from "@/hooks/use-navigate";
import ChatPage from "@/pages/chat";
import SettingsPage from "@/pages/settings";
import AppSidebar from "./app-sidebar";
import { Titlebar } from "../title-bar";

export default function DashboardLayout({
  children,
  props,
}: {
  children: ReactNode;
  props: React.ComponentProps<typeof Sidebar>;
}) {
  const { view } = useNavigate();

  return (
    <SidebarProvider>
      <AppSidebar {...props} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <Titlebar />
        </header>
        {view.name === "chat" ? (
          <ChatPage />
        ) : view.name === "settings" ? (
          <SettingsPage />
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            {children}
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
