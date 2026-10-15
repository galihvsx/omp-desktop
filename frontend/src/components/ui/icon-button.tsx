import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IconButtonProps = ComponentProps<typeof Button> & {
  tone?: "plain" | "sidebar";
  label: string;
  icon: ReactNode;
};

const ICON_BUTTON_TONES = {
  plain: "size-5 p-0 text-muted-foreground hover:text-foreground",
  sidebar:
    "size-5 p-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
};

export function IconButton({
  tone = "plain",
  label,
  icon,
  className,
  type = "button",
  variant = "ghost",
  size = "icon-xs",
  "aria-label": ariaLabel,
  ...props
}: IconButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      aria-label={ariaLabel ?? label}
      className={cn(ICON_BUTTON_TONES[tone], className)}
      {...props}
    >
      {icon}
    </Button>
  );
}
