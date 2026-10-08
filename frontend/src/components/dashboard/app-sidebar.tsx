import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useNavigate, type View } from "@/hooks/use-navigate";
import { MessageCirclePlusIcon, MessagesSquareIcon, SettingsIcon } from "lucide-react";
import { ReactNode } from "react";
import Logo from "../../public/img/logo.svg";
import NavWorkspace from "./nav-workspace";

type NavItem = {
  title: string,
  icon: ReactNode,
  view: View,
}

const navMain: NavItem[] = [
  {
    title: "Sesi Baru",
    icon: <MessageCirclePlusIcon />,
    view: { name: "dashboard" },
  },
  {
    title: "Workspace",
    icon: <MessagesSquareIcon />,
    view: { name: "chat" },
  },
  {
    title: "Pengaturan",
    icon: <SettingsIcon />,
    view: { name: "settings" },
  },
];

export default function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { navigate, view } = useNavigate()
  return (
    <Sidebar {...props} collapsible="icon">
      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 overflow-hidden rounded-md p-2">
          <div className="bg-primary text-primary-foreground group/child relative flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
            <div className="absolute size-4 transition-opacity group-hover/child:hidden">
              <img src={Logo} alt="" />
            </div>
            <SidebarTrigger className="bg-none opacity-0 transition-opacity group-hover/child:opacity-100 focus-visible:opacity-100" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span className="font-bold">OMP</span>
            <span className="text-xs">Desktop</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={view.name === item.view.name}
                  onClick={() => navigate(item.view)}
                >
                  {item.icon}
                  {item.title}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <NavWorkspace />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
