import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useNavigate, type View } from "@/hooks/use-navigate";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import {
  BotIcon,
  ChevronDownIcon,
  CirclePlusIcon,
  FilterIcon,
  FolderIcon,
  HashIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import NavWorkspace from "./nav-workspace";
import PiLogo from "../pi-logo";

type NavItem = {
  labelKey: TranslationKey;
  icon: ReactNode;
  shortcut?: string;
  view?: View;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  {
    labelKey: "sidebar.newSession",
    icon: <CirclePlusIcon className="size-4" />,
    shortcut: "Ctrl+N",
    view: { name: "new-session" },
  },
  {
    labelKey: "sidebar.search",
    icon: <SearchIcon className="size-4" />,
    shortcut: "Ctrl+K",
  },
  {
    labelKey: "sidebar.automations",
    icon: <BotIcon className="size-4" />,
    disabled: true,
  },
  {
    labelKey: "sidebar.pluginMarketplace",
    icon: <PuzzleIcon className="size-4" />,
    disabled: true,
  },
];

export default function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { navigate, view } = useNavigate();
  const { t } = useTranslation();

  return (
    <Sidebar {...props} collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border/40 pb-2">
        <div className="flex h-10 items-center gap-2 overflow-hidden rounded-md px-0">
          <div className="bg-none text-primary-foreground group/child relative flex aspect-square size-7 shrink-0 items-center justify-center rounded-lg">
            <div className="absolute inset-0 flex items-center justify-center transition-opacity group-hover/child:hidden">
              <PiLogo className="size-6 shrink-0" />
            </div>
            <SidebarTrigger className="bg-none opacity-0 transition-opacity group-hover/child:opacity-100 focus-visible:opacity-100" />
          </div>
          <div className="flex min-w-full flex-col gap-0.5 leading-none">
            <span className="font-bold text-ui-sm tracking-tight">OMP</span>
            <span className="text-ui-xs text-muted-foreground">Desktop</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-1">
        <SidebarGroup className="p-1">
          <SidebarMenu className="gap-0.5">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.labelKey}>
                <SidebarMenuButton
                  size="sm"
                  isActive={item.view ? view.name === item.view.name : false}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.view) {
                      navigate(item.view);
                    }
                  }}
                >
                  {item.icon}
                  <div className="text-sm">{t(item.labelKey)}</div>
                </SidebarMenuButton>
                {item.shortcut ? (
                  <SidebarMenuBadge className="font-mono text-muted-foreground/70">
                    {item.shortcut}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <div className="flex items-center gap-1 px-2.5 py-1 text-ui-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="px-1.5 text-ui-sm border-sidebar-border/80 bg-sidebar-accent/40 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <HashIcon className="size-3" />
            <span>{t("sidebar.group")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="px-1.5 text-ui-sm border-sidebar-border/80 bg-sidebar-accent/40 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <FolderIcon className="size-3" />
            <span>{t("sidebar.project")}</span>
          </Button>
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton
              tone="sidebar"
              label="Filter"
              className="text-muted-foreground/70"
              title="Filter"
              icon={<FilterIcon className="size-3" />}
            />
            <IconButton
              tone="sidebar"
              label="View options"
              className="text-muted-foreground/70"
              title="View options"
              icon={<SlidersHorizontalIcon className="size-3" />}
            />
          </div>
        </div>

        <NavWorkspace />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-2 group-data-[collapsible=icon]:p-1">
        <div className="flex items-center justify-between gap-1">
          <div className="group/acc flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 hover:bg-sidebar-accent cursor-pointer group-data-[collapsible=icon]:justify-center transition-colors">
            <Avatar size="sm" className="size-6 text-xs shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-ui-xs font-bold">
                GP
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="truncate text-ui-xs font-semibold">
                Galih Putro
              </span>
            </div>
            <Badge
              variant="secondary"
              className="font-mono group-data-[collapsible=icon]:hidden shrink-0"
            >
              omp
            </Badge>
            <ChevronDownIcon className="size-3 text-muted-foreground group-data-[collapsible=icon]:hidden shrink-0" />
          </div>
          <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
            <SidebarTrigger className="size-6 text-muted-foreground hover:text-foreground" />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => navigate({ name: "settings" })}
              title={t("sidebar.settings")}
            >
              <SettingsIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}