import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
} from "lucide-react";

import { Item, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import type { TodoItem } from "@/lib/todo";
import { cn } from "@/lib/utils";

export type TodoRowsProps = {
  items: TodoItem[];
  variant?: "transcript" | "panel";
  className?: string;
};

const TODO_GLYPHS: Record<TodoItem["status"], string> = {
  pending: "○",
  inProgress: "→",
  completed: "✓",
};

const TODO_TONES: Record<TodoItem["status"], string> = {
  pending: "text-muted-foreground/50",
  inProgress: "text-foreground",
  completed: "text-muted-foreground/70",
};

function PanelStatusGlyph({ status }: { status: TodoItem["status"] }) {
  if (status === "completed") {
    return (
      <CheckCircle2Icon className="size-3.5 shrink-0 text-muted-foreground" />
    );
  }
  if (status === "inProgress") {
    return <ArrowRightIcon className="size-3.5 shrink-0 text-foreground" />;
  }
  return <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/40" />;
}

export function TodoRows({
  items,
  variant = "transcript",
  className,
}: TodoRowsProps) {
  if (variant === "panel") {
    return (
      <ItemGroup className={cn("gap-1", className)}>
        {items.map((item, index) => (
          <Item
            key={index}
            size="xs"
            variant={item.status === "inProgress" ? "muted" : "default"}
            className="flex-nowrap items-start"
          >
            <ItemMedia className="mt-0.5">
              <PanelStatusGlyph status={item.status} />
            </ItemMedia>
            <ItemTitle className="min-w-0 flex-1 items-start">
              <span className={TODO_TONES[item.status]}>{item.text}</span>
            </ItemTitle>
          </Item>
        ))}
      </ItemGroup>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {items.map((item, index) => (
        <div className="flex items-start gap-2 text-ui-xs" key={index}>
          <span
            className={cn("w-3 shrink-0 text-center", TODO_TONES[item.status])}
          >
            {TODO_GLYPHS[item.status]}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 wrap-anywhere",
              item.status === "completed" && "text-muted-foreground/70"
            )}
          >
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}
