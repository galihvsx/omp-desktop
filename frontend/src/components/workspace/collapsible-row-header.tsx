import type * as React from "react";
import { ChevronRightIcon } from "lucide-react";

import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type CollapsibleRowHeaderProps = {
  open: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  meta?: React.ReactNode;
  tone?: "default" | "destructive";
  className?: string;
  render?: React.ReactElement;
  chevronPosition?: "left" | "right";
  chevronClassName?: string;
  onClick?: React.MouseEventHandler;
};

export function CollapsibleRowHeader({
  open,
  icon,
  children,
  meta,
  tone = "default",
  className,
  render,
  chevronPosition = "right",
  chevronClassName,
  onClick,
}: CollapsibleRowHeaderProps) {
  const chevron = (
    <ChevronRightIcon
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
        open && "rotate-90",
        chevronClassName,
      )}
    />
  );

  return (
    <CollapsibleTrigger
      className={cn(
        "flex items-center gap-1.5 py-1 text-ui-xs text-muted-foreground/80 hover:text-foreground transition-colors group select-none cursor-pointer",
        tone === "destructive" && "text-destructive hover:text-destructive",
        className,
      )}
      render={render}
      onClick={onClick}
    >
      {chevronPosition === "left" && chevron}
      {icon}
      {children}
      {meta}
      {chevronPosition === "right" && chevron}
    </CollapsibleTrigger>
  );
}
