import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingsNavItemProps = {
  icon: ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
  className?: string;
};

export function SettingsNavItem({
  icon,
  label,
  active,
  onSelect,
  className,
}: SettingsNavItemProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn("w-full justify-start text-left", className)}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
