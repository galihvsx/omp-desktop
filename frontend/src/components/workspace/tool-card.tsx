import {
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { OmpToolPart } from "@/stores/omp-chat-store";
import type { ToolUIPart } from "ai";
import {
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  FilePenLineIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderSearchIcon,
  GlobeIcon,
  ListTodoIcon,
  SearchIcon,
  SquareTerminalIcon,
  TriangleAlertIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const FAMILY_ICONS: Record<string, LucideIcon> = {
  bash: SquareTerminalIcon,
  read: FileTextIcon,
  write: FilePlus2Icon,
  edit: FilePenLineIcon,
  glob: FolderSearchIcon,
  grep: SearchIcon,
  task: BotIcon,
  todo: ListTodoIcon,
  web_search: GlobeIcon,
};

function StateBadge({ state }: { state: ToolUIPart["state"] }) {
  if (state === "output-available") {
    return (
      <Badge className="gap-1 text-ui-xs text-muted-foreground" variant="secondary">
        <CheckIcon className="size-3" />
        selesai
      </Badge>
    );
  }

  if (state === "output-error") {
    return (
      <Badge className="gap-1 text-ui-xs text-destructive" variant="secondary">
        <TriangleAlertIcon className="size-3" />
        gagal
      </Badge>
    );
  }

  if (state === "input-available") {
    return (
      <Badge className="gap-1 text-ui-xs" variant="secondary">
        <Spinner className="size-3" />
        berjalan
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 text-ui-xs" variant="secondary">
      <Spinner className="size-3" />
      menyiapkan
    </Badge>
  );
}

export function ToolCard({ part }: { part: OmpToolPart }) {
  const [open, setOpen] = useState(part.state === "output-error");

  const toolType = part.type as ToolUIPart["type"];
  const state = part.state as ToolUIPart["state"];
  const family = toolType.replace(/^tool-/, "");
  const Icon = FAMILY_ICONS[family] ?? WrenchIcon;
  const label = family.replace(/[-_]/g, " ");

  return (
    <Tool
      className="mb-0 overflow-hidden rounded-xl border bg-card"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-ui-sm font-medium">
          {label}
        </span>
        <StateBadge state={state} />
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      </CollapsibleTrigger>
      <ToolContent className="border-t p-3">
        <ToolInput input={part.input} />
        <ToolOutput errorText={part.errorText} output={part.output} />
      </ToolContent>
    </Tool>
  );
}
