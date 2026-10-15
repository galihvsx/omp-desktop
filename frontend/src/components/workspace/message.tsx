import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { MetaRow } from "@/components/ui/meta-row";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { CollapsibleRowHeader } from "@/components/workspace/collapsible-row-header";
import { TodoRows } from "@/components/workspace/todo-rows";
import { ReadRow, ToolCard, isReadPart } from "@/components/workspace/tool-card";
import { useTranslation } from "@/lib/i18n";
import { parseTodo, type TodoItem } from "@/lib/todo";
import { codeThemeShiki, useAppearance } from "@/features/appearance";
import type { OmpMessage, OmpMessagePart } from "@/features/omp";
import {
  AlertCircleIcon,
  BrainIcon,
  ListTodoIcon,
  SearchIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type OmpTextPart = Extract<OmpMessagePart, { type: "text" }>;

type OmpWorkPart = Exclude<OmpMessagePart, OmpTextPart>;

type OmpToolPart = Extract<OmpMessagePart, { type: `tool-${string}` }>;

const isTextPart = (part: OmpMessagePart): part is OmpTextPart =>
  part.type === "text";

function MarkdownResponse({
  className,
  children,
}: {
  className?: string;
  children: string;
}) {
  const { codeTheme, showLineNumbers } = useAppearance();

  return (
    <MessageResponse
      className={className}
      lineNumbers={showLineNumbers}
      shikiTheme={codeThemeShiki(codeTheme)}
    >
      {children}
    </MessageResponse>
  );
}

const AUTO_COLLAPSE_MS = 1000;

type WorkClock =
  | { kind: "running"; elapsedMs: number }
  | { kind: "done"; elapsedMs: number }
  | { kind: "unknown" };

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) {
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}

function useWorkClock(
  startedAt: number | undefined,
  endedAt: number | undefined,
  streaming: boolean,
): WorkClock {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!streaming || startedAt === undefined) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, streaming]);

  if (startedAt === undefined) {
    return { kind: "unknown" };
  }
  if (streaming) {
    return { kind: "running", elapsedMs: Math.max(0, now - startedAt) };
  }
  if (endedAt === undefined) {
    return { kind: "unknown" };
  }
  return { kind: "done", elapsedMs: Math.max(0, endedAt - startedAt) };
}

function ReasoningBlock({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(streaming);
  const [manual, setManual] = useState(false);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (manual) {
      return;
    }
    if (streaming) {
      setOpen(true);
      return;
    }
    const timer = window.setTimeout(() => setOpen(false), AUTO_COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [manual, streaming]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !follow || !streaming) {
      return;
    }
    pane.scrollTop = pane.scrollHeight;
  }, [text, follow, streaming]);

  const handleScroll = () => {
    const pane = paneRef.current;
    if (!pane) {
      return;
    }
    const atBottom =
      pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 8;
    setFollow(atBottom);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setManual(true);
        setOpen(next);
      }}
    >
      <CollapsibleRowHeader
        open={open}
        icon={
          <BrainIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        }
      >
        {streaming ? (
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Spinner className="size-3" />
            <Shimmer duration={1}>{t("workspace.thinkingStreaming")}</Shimmer>
          </span>
        ) : (
          <span>{t("workspace.thought")}</span>
        )}
      </CollapsibleRowHeader>
      <CollapsibleContent className="mt-1 mb-2">
        <div
          className="max-h-64 overflow-y-auto pr-1 text-ui-xs text-muted-foreground"
          onScroll={handleScroll}
          ref={paneRef}
        >
          <MarkdownResponse className="min-w-0 wrap-anywhere">
            {text}
          </MarkdownResponse>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type TranscriptSegment =
  | { kind: "text"; key: number; text: string }
  | { kind: "work"; key: number; parts: OmpWorkPart[] };
function segmentParts(parts: OmpMessagePart[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: Extract<TranscriptSegment, { kind: "work" }> | null = null;

  parts.forEach((part, index) => {
    if (isTextPart(part)) {
      current = null;
      segments.push({ kind: "text", key: index, text: part.text });
      return;
    }
    if (current) {
      current.parts.push(part);
      return;
    }
    current = { kind: "work", key: index, parts: [part] };
    segments.push(current);
  });

  return segments;
}

type WorkRow =
  | { kind: "part"; key: number; part: OmpWorkPart }
  | { kind: "reads"; key: number; parts: OmpToolPart[] };

function workRows(parts: OmpWorkPart[]): WorkRow[] {
  const rows: WorkRow[] = [];
  let run: Extract<WorkRow, { kind: "reads" }> | null = null;

  parts.forEach((part, offset) => {
    if (isReadPart(part)) {
      if (run) {
        run.parts.push(part);
        return;
      }
      run = { kind: "reads", key: offset, parts: [part] };
      rows.push(run);
      return;
    }
    run = null;
    rows.push({ kind: "part", key: offset, part });
  });

  return rows;
}

function ExploreGroup({ parts }: { parts: OmpToolPart[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const failed = parts.some((part) => part.state === "output-error");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleRowHeader
        open={open}
        icon={
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        }
        meta={
          failed ? (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircleIcon className="size-3" />
              {t("workspace.toolFailed")}
            </span>
          ) : null
        }
      >
        <span>{t("workspace.explore")}</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{t("workspace.exploreFiles", { count: parts.length })}</span>
      </CollapsibleRowHeader>
      <CollapsibleContent className="mt-0.5 mb-1 space-y-0.5 pl-5">
        {parts.map((part) => (
          <ReadRow key={part.toolCallId} part={part} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TodoBlock({ part }: { part: OmpToolPart }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const todo =
    part.state === "output-error"
      ? null
      : parseTodo(part.input, part.outputDetails ?? part.output);

  if (!todo) {
    return <ToolCard part={part} />;
  }

  const done = todo.items.filter((item) => item.status === "completed").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleRowHeader
        open={open}
        icon={
          <ListTodoIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        }
        meta={
          <span className="shrink-0 tabular-nums text-muted-foreground/60">
            {done}/{todo.items.length}
          </span>
        }
      >
        <span>{t("workspace.todo")}</span>
        {todo.title ? (
          <span className="min-w-0 truncate text-muted-foreground/70">
            {todo.title}
          </span>
        ) : null}
      </CollapsibleRowHeader>
      <CollapsibleContent className="mt-0.5 mb-1 space-y-0.5 pl-5">
        <TodoRows items={todo.items} variant="transcript" />
      </CollapsibleContent>
    </Collapsible>
  );
}

function WorkGroupBlock({
  firstIndex,
  lastPartIndex,
  parts,
  streaming,
}: {
  firstIndex: number;
  lastPartIndex: number;
  parts: OmpWorkPart[];
  streaming: boolean;
}) {
  return (
    <div className="space-y-1.5 py-0.5">
      {workRows(parts).map((row) => {
        const index = firstIndex + row.key;
        if (row.kind === "reads") {
          return row.parts.length > 1 ? (
            <ExploreGroup key={index} parts={row.parts} />
          ) : (
            <ReadRow key={index} part={row.parts[0]} />
          );
        }
        const { part } = row;
        if (part.type === "reasoning") {
          return (
            <ReasoningBlock
              key={index}
              streaming={streaming && index === lastPartIndex}
              text={part.text}
            />
          );
        }
        return part.type === "tool-todo" ? (
          <TodoBlock key={part.toolCallId} part={part} />
        ) : (
          <ToolCard key={part.toolCallId} part={part} />
        );
      })}
    </div>
  );
}

function AssistantMessage({
  message,
  streaming,
}: {
  message: OmpMessage;
  streaming: boolean;
}) {
  const segments = segmentParts(message.parts);
  const lastPartIndex = message.parts.length - 1;
  const clock = useWorkClock(message.startedAt, message.endedAt, streaming);
  const { t } = useTranslation();
  const running = streaming && clock.kind === "running";

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {running ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-ui-sm font-medium text-muted-foreground/80">
            {t("workspace.workingFor", {
              duration: formatDuration(clock.elapsedMs),
            })}
          </span>
          <Separator />
        </div>
      ) : null}

      {segments.map((segment) =>
        segment.kind === "text" ? (
          <MarkdownResponse
            key={segment.key}
            className="min-w-0 wrap-anywhere text-ui-base leading-relaxed"
          >
            {segment.text}
          </MarkdownResponse>
        ) : (
          <WorkGroupBlock
            firstIndex={segment.key}
            key={segment.key}
            lastPartIndex={lastPartIndex}
            parts={segment.parts}
            streaming={streaming}
          />
        ),
      )}

      {running ? (
        <div className="flex items-center">
          <Spinner className="size-3 text-muted-foreground/80" />
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceMessage({
  message,
  streaming,
}: {
  message: OmpMessage;
  streaming: boolean;
}) {
  if (message.role === "user") {
    const text = message.parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join("\n");

    return (
      <div className="max-w-3/4 self-end whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-2.5 text-ui-base wrap-anywhere">
        {text}
      </div>
    );
  }

  return <AssistantMessage message={message} streaming={streaming} />;
}
