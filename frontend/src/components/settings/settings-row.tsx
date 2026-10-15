import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SettingsRowProps = {
  title: string;
  description: string;
  align?: "center" | "start";
  controlClassName?: string;
  className?: string;
  children: ReactNode;
};

export function SettingsRow({
  title,
  description,
  align = "center",
  controlClassName,
  className,
  children,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between gap-6 px-4 py-3.5",
        align === "start" ? "items-start" : "items-center",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui-sm font-medium text-foreground">{title}</span>
        <span className="text-ui-xs text-muted-foreground">{description}</span>
      </div>
      <div className={cn("shrink-0", controlClassName)}>{children}</div>
    </div>
  );
}
