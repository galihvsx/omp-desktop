import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipTriggerProps = ComponentProps<"button"> & {
  icon?: ReactNode;
  label: ReactNode;
  trailing?: ReactNode;
  chevron?: "down" | "right" | "none";
  open?: boolean;
  tone?: "default" | "muted" | "header";
};

export const COMPOSER_CHIP_CLASS =
  "inline-flex items-center h-7 rounded-lg border border-border/70 bg-muted/40 px-2 text-ui-xs font-medium text-foreground gap-1.5 hover:bg-muted/70 transition-colors max-w-48 justify-between select-none";

const CHIP_TRIGGER_TONES = {
  default: COMPOSER_CHIP_CLASS,
  muted:
    "inline-flex items-center h-7 rounded-lg border border-border/70 bg-muted/40 px-2 text-ui-sm font-medium text-foreground gap-1.5 hover:bg-muted/70 transition-colors max-w-48 justify-between",
  header:
    "inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 border border-border/60 text-ui-sm text-foreground max-w-88",
};

export function ChipTrigger({
  icon,
  label,
  trailing,
  chevron = "down",
  open = false,
  tone = "default",
  className,
  type = "button",
  ...props
}: ChipTriggerProps) {
  return (
    <button
      type={type}
      className={cn(
        "shrink-0 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        CHIP_TRIGGER_TONES[tone],
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        {icon}
        {typeof label === "string" || typeof label === "number" ? (
          <span className="truncate">{label}</span>
        ) : (
          label
        )}
      </span>
      {trailing}
      {chevron === "down" ? (
        <ChevronDown
          className={cn(
            "size-2.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      ) : chevron === "right" ? (
        <ChevronRight
          className={cn(
            "size-2.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      ) : null}
    </button>
  );
}
