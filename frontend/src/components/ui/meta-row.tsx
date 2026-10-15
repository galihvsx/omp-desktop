import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MetaRowProps = {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  className?: string;
  align?: "center" | "start";
};

export function MetaRow({
  label,
  value,
  title,
  className,
  align = "center",
}: MetaRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2",
        align === "start" ? "items-start" : "items-center",
        className,
      )}
      title={title}
    >
      <span className="font-medium text-foreground">{label}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}
