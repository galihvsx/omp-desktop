import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusBadgeProps = {
  tone: "done" | "error" | "running";
  icon: ReactNode;
  children: ReactNode;
  className?: string;
};

const STATUS_BADGE_TONES = {
  done: "text-muted-foreground",
  error: "text-destructive",
  running: "text-muted-foreground",
};

export function StatusBadge({
  tone,
  icon,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-4 gap-1 px-1.5 py-0 text-ui-xs font-normal",
        STATUS_BADGE_TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </Badge>
  );
}
