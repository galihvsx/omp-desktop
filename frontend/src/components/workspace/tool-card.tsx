import { CodeBlock } from "@/components/ai-elements/code-block";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { CollapsibleRowHeader } from "@/components/workspace/collapsible-row-header";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { OmpMessagePart } from "@/features/omp";
import type { ToolUIPart } from "ai";
import {
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FilePenLineIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderSearchIcon,
  GlobeIcon,
  ImageIcon,
  ListTodoIcon,
  SearchIcon,
  SquareTerminalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type OmpToolPart = Extract<OmpMessagePart, { type: `tool-${string}` }>;

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
  terminal: SquareTerminalIcon,
  skill: WrenchIcon,
};

function formatSummary(family: string, input: unknown): string {
  if (!input || typeof input !== "object") {
    return typeof input === "string" ? input : "";
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.command === "string") return obj.command;
  if (typeof obj.path === "string") return obj.path;
  if (typeof obj.file_path === "string") return obj.file_path;
  if (typeof obj.query === "string") return obj.query;
  if (typeof obj.pattern === "string") return obj.pattern;
  if (typeof obj.description === "string") return obj.description;
  if (typeof obj.prompt === "string") return obj.prompt;
  if (typeof obj.name === "string") return obj.name;

  try {
    const raw = JSON.stringify(input);
    return raw.length > 80 ? raw.slice(0, 80) + "…" : raw;
  } catch {
    return "";
  }
}

function extractImage(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === "string") {
    if (
      output.startsWith("data:image/") ||
      (output.startsWith("https://") &&
        (output.endsWith(".png") ||
          output.endsWith(".jpg") ||
          output.endsWith(".jpeg")))
    ) {
      return output;
    }
    return null;
  }
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.imageSource === "string") return obj.imageSource;
    if (typeof obj.image === "string") return obj.image;
    if (typeof obj.imageUrl === "string") return obj.imageUrl;
  }
  return null;
}

const IMAGE_EXTENSIONS = [
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
];

const CODE_EXTENSIONS = [
  "bash",
  "c",
  "cc",
  "cjs",
  "cpp",
  "cs",
  "css",
  "dart",
  "go",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "jsx",
  "kt",
  "kts",
  "less",
  "mjs",
  "php",
  "ps1",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "svelte",
  "swift",
  "toml",
  "ts",
  "tsx",
  "vue",
  "xml",
  "yaml",
  "yml",
];

const TEXT_EXTENSIONS = [
  "cfg",
  "csv",
  "env",
  "ini",
  "log",
  "md",
  "mdx",
  "tsv",
  "txt",
];

function extensionOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dot = path.lastIndexOf(".");
  return dot > cut ? path.slice(dot + 1).toLowerCase() : "";
}

export function fileIconFor(path: string): LucideIcon {
  const extension = extensionOf(path);
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return ImageIcon;
  }
  if (extension === "json" || extension === "jsonl" || extension === "ndjson") {
    return FileJsonIcon;
  }
  if (CODE_EXTENSIONS.includes(extension)) {
    return FileCodeIcon;
  }
  return TEXT_EXTENSIONS.includes(extension) ? FileTextIcon : FileIcon;
}

export function readPathOf(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  if (!("path" in input)) {
    return null;
  }
  const path = input.path;
  return typeof path === "string" && path ? path : null;
}

export function splitPath(path: string): { name: string; dir: string } {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (cut < 0) {
    return { name: path, dir: "" };
  }
  return { name: path.slice(cut + 1), dir: path.slice(0, cut + 1) };
}

export function isReadPart(part: OmpMessagePart): part is OmpToolPart {
  return part.type === "tool-read";
}

export function ReadRow({ part }: { part: OmpToolPart }) {
  const { t } = useTranslation();
  const path = readPathOf(part.input);
  const split = path === null ? null : splitPath(path);
  const Icon = path === null ? FileIcon : fileIconFor(path);
  const failed = part.state === "output-error";

  return (
    <div className="flex h-6 min-w-0 items-center gap-2 text-ui-xs">
      <span className="shrink-0 font-medium capitalize text-muted-foreground">
        {part.type.replace(/^tool-/, "").replace(/[-_]/g, " ")}
      </span>
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          failed ? "text-destructive" : "text-muted-foreground",
        )}
      />
      {split ? (
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-ui-sm",
            failed ? "text-destructive" : "text-foreground/80",
          )}
          title={path ?? undefined}
        >
          {split.name}
        </span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {split && split.dir ? (
        <span className="max-w-9/20 shrink-0 truncate font-mono text-ui-sm text-muted-foreground/60">
          {split.dir}
        </span>
      ) : null}
      {failed ? (
        <span className="flex shrink-0 items-center gap-1 text-ui-xs text-destructive">
          <AlertCircleIcon className="size-2.5" />
          {t("workspace.toolFailed")}
        </span>
      ) : part.state === "output-available" ? null : (
        <Spinner className="size-3 shrink-0 text-muted-foreground/60" />
      )}
    </div>
  );
}

export function ToolCard({ part }: { part: OmpToolPart }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(part.state === "output-error");

  const toolType = part.type as ToolUIPart["type"];
  const state = part.state as ToolUIPart["state"];
  const family = toolType.replace(/^tool-/, "");

  if (family === "read") {
    return <ReadRow part={part} />;
  }
  const Icon = FAMILY_ICONS[family] ?? WrenchIcon;
  const label = family.replace(/[-_]/g, " ");
  const summary = formatSummary(family, part.input);
  const imageUrl = extractImage(part.output);

  const payloadString =
    typeof part.output === "string"
      ? part.output
      : part.output !== undefined
        ? JSON.stringify(part.output, null, 2)
        : part.errorText
          ? part.errorText
          : JSON.stringify(part.input, null, 2);

  const copyPayload = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(payloadString).then(() => {
      toast.success("Copied to clipboard");
    });
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<Card size="sm" className="transition-all" />}
    >
      <CollapsibleRowHeader
        open={open}
        render={<div />}
        className="h-8 gap-2 px-2.5 py-1.5 text-foreground hover:bg-muted/40"
        chevronClassName="size-3 text-muted-foreground/60"
        icon={<Icon className="size-3.5 shrink-0 text-muted-foreground" />}
        meta={
          state === "output-available" ? (
            <StatusBadge tone="done" icon={<CheckIcon className="size-2.5" />}>
              {t("workspace.toolDone")}
            </StatusBadge>
          ) : state === "output-error" ? (
            <StatusBadge
              tone="error"
              icon={<AlertCircleIcon className="size-2.5" />}
            >
              {t("workspace.toolFailed")}
            </StatusBadge>
          ) : (
            <StatusBadge
              tone="running"
              icon={<Spinner className="size-2.5" />}
            >
              {t("workspace.toolRunning")}
            </StatusBadge>
          )
        }
      >
        <span className="font-medium text-ui-xs shrink-0 capitalize">{label}</span>
        {summary ? (
          <span
            className="min-w-0 flex-1 truncate font-mono text-ui-sm text-muted-foreground"
            title={summary}
          >
            {summary}
          </span>
        ) : (
          <span className="flex-1" />
        )}
      </CollapsibleRowHeader>

      {open && (
        <div className="border-t border-border/60 bg-muted/20 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-semibold text-ui-xs text-foreground uppercase tracking-wider">
              {part.errorText
                ? t("workspace.toolError")
                : t("workspace.toolResult")}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                tone="plain"
                label="Copy result"
                icon={<CopyIcon className="size-3" />}
                onClick={copyPayload}
                title="Copy result"
              />
              <IconButton
                tone="plain"
                label="Collapse"
                icon={<ChevronDownIcon className="size-3" />}
                onClick={() => setOpen(false)}
                title="Collapse"
              />
            </div>
          </div>

          {imageUrl && (
            <div className="overflow-hidden rounded-lg border border-border/80 bg-background max-h-72">
              <img
                src={imageUrl}
                alt="Tool output"
                className="max-h-72 w-full object-contain"
              />
            </div>
          )}

          <div
            className={cn(
              "max-h-60 overflow-auto rounded-lg text-xs font-mono",
              part.errorText
                ? "bg-destructive/10 text-destructive p-2.5 border border-destructive/20"
                : "bg-muted/40 border border-border/60 text-foreground",
            )}
          >
            {part.errorText ? (
              <div className="whitespace-pre-wrap wrap-anywhere">
                {part.errorText}
              </div>
            ) : (
              <CodeBlock code={payloadString} language="json" />
            )}
          </div>
        </div>
      )}
    </Collapsible>
  );
}