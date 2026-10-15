import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MonoValueProps = {
  children: ReactNode;
  title?: string;
  className?: string;
};

export function MonoValue({ children, title, className }: MonoValueProps) {
  return (
    <span
      className={cn(
        "font-mono text-ui-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/60",
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}
