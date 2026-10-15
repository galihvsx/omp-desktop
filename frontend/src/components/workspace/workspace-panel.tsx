import { useEffect, useMemo, useState } from "react";
import {
  BotIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  Minimize2Icon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react";

import { CommitDialog } from "./commit-dialog";
import { GitSummaryRow } from "./git-summary-row";
import { TodoRows } from "./todo-rows";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { MetaRow } from "@/components/ui/meta-row";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Item,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  useTranslation,
  type TranslationKey,
  type TranslationVars,
} from "@/lib/i18n";
import { parseTodo, type TodoList } from "@/lib/todo";
import {
  useEnableAgentFrames,
  useGitStatus,
  useOmpSession,
  useOmpSessionActions,
  usePanel,
  usePanelAgents,
  useRevealPath,
  type OmpMessage,
  type PanelAgent,
  type SessionStatus,
} from "@/features/omp";

const NO_MESSAGES: OmpMessage[] = [];

type Translate = (key: TranslationKey, vars?: TranslationVars) => string;

function latestTodos(messages: OmpMessage[]): TodoList | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const parts = messages[index].parts;
    for (let part = parts.length - 1; part >= 0; part -= 1) {
      const candidate = parts[part];
      if (candidate.type !== "tool-todo") {
        continue;
      }
      return parseTodo(candidate.input, candidate.outputDetails ?? candidate.output);
    }
  }
  return null;
}

function activityText(
  agents: PanelAgent[],
  status: SessionStatus,
  translate: Translate
): string {
  const agent = agents[0];
  if (agent?.task) {
    return agent.task;
  }
  if (status === "busy" || status === "connecting") {
    return translate("panel.working");
  }
  return translate("panel.idle");
}

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

function ProgressSection({ todos }: { todos: TodoList }) {
  const { t } = useTranslation();
  const done = todos.items.filter((item) => item.status === "completed").length;

  return (
    <div className="flex flex-col gap-1.5 text-ui-xs">
      <MetaRow
        label={t("panel.progress")}
        value={`${done}/${todos.items.length}`}
      />
      <TodoRows items={todos.items} variant="panel" />
    </div>
  );
}

function AgentRow({ agent }: { agent: PanelAgent }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(() =>
    agent.startedAt ? Math.max(0, Date.now() - agent.startedAt) : 0
  );

  useEffect(() => {
    if (!agent.startedAt) {
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Date.now() - (agent.startedAt ?? Date.now())));
    }, 1000);
    return () => clearInterval(interval);
  }, [agent.startedAt]);

  const durationStr = agent.startedAt ? formatDuration(elapsed) : null;

  return (
    <Item size="xs" variant="muted" className="flex-col items-start">
      <div className="flex w-full min-w-0 items-center gap-1.5 font-medium text-foreground">
        <ItemMedia variant="icon">
          <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </ItemMedia>
        <ItemTitle
          className="min-w-0 flex-1"
          title={agent.task || agent.agent}
        >
          {agent.task || agent.agent}
        </ItemTitle>
      </div>
      {durationStr ? (
        <ItemDescription>
          {t("panel.runningFor", { duration: durationStr })}
        </ItemDescription>
      ) : null}
    </Item>
  );
}

function AgentsSection({ agents }: { agents: PanelAgent[] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5 text-ui-xs">
      <MetaRow
        label={t("panel.agents")}
        value={t("panel.agentsRunning", { count: agents.length })}
      />
      <ItemGroup>
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </ItemGroup>
    </div>
  );
}

export function WorkspacePanel() {
  const { t } = useTranslation();
  const runtime = useOmpSession();
  const { collapsed, toggleCollapsed } = usePanel();
  const send = useOmpSessionActions().send;
  const revealPath = useRevealPath();
  const enableAgentFrames = useEnableAgentFrames();
  const [reloads, setReloads] = useState(0);

  const key = runtime?.key ?? "";
  const cwd = runtime?.cwd ?? "";
  const sessionStatus = runtime?.status ?? "disconnected";
  const messages = runtime?.messages ?? NO_MESSAGES;
  const agents = usePanelAgents(runtime ? runtime.key : null);
  const { status } = useGitStatus(cwd, `${sessionStatus}:${reloads}`);

  useEffect(() => {
    if (!key || sessionStatus !== "ready") {
      return;
    }
    void enableAgentFrames(key).catch(() => {
    });
  }, [key, sessionStatus, enableAgentFrames]);

  const todos = useMemo(() => latestTodos(messages), [messages]);

  if (!runtime) {
    return null;
  }

  if (collapsed) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={false}
        aria-label={t("panel.expand")}
        title={t("panel.expand")}
        onClick={() => toggleCollapsed()}
        className="absolute right-4 top-3 z-20 max-w-64 select-none"
      >
        <span className="truncate">
          {activityText(agents, sessionStatus, t)}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </Button>
    );
  }

  const branch = status?.branch ?? "";
  const changed = status?.changed ?? 0;
  const insertions = status?.insertions ?? 0;
  const deletions = status?.deletions ?? 0;
  const canCommit = sessionStatus === "ready" || sessionStatus === "disconnected";

  return (
    <Card
      size="sm"
      aria-label={t("panel.title")}
      className="absolute right-4 top-3 z-20 max-h-[min(70vh,30rem)] w-60 overflow-hidden select-none"
    >
      <div className="flex shrink-0 items-center justify-between gap-1 px-3 pt-2.5 pb-1.5">
        <span className="text-ui-xs font-semibold tracking-tight text-foreground">
          {t("panel.title")}
        </span>
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <IconButton
                  tone="plain"
                  label={t("panel.options")}
                  icon={<MoreHorizontalIcon className="size-3.5" />}
                />
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setReloads((count) => count + 1)}>
                <RefreshCwIcon className="size-3.5" />
                {t("panel.refresh")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!cwd}
                onClick={() => {
                  void revealPath(cwd);
                }}
              >
                <FolderOpenIcon className="size-3.5" />
                {t("panel.reveal")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton
            tone="plain"
            aria-expanded={true}
            label={t("panel.collapse")}
            title={t("panel.collapse")}
            onClick={() => toggleCollapsed()}
            icon={<Minimize2Icon className="size-3.5" />}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 pb-2.5">
        <div className="flex flex-col gap-0.5 text-ui-xs">
          <MetaRow
            label={t("panel.changes")}
            value={changed === 0 ? t("panel.clean") : changed}
            title={t("panel.changesCount", { count: changed })}
            className="py-0.5"
          />
          <GitSummaryRow
            branch={branch || t("panel.branchUnknown")}
            insertions={insertions}
            deletions={deletions}
            changed={changed}
            labels={{
              changes: t("panel.changes"),
              insertions: t("panel.insertions"),
              deletions: t("panel.deletions"),
            }}
            className="py-0.5"
          />
          <CommitDialog
            status={status}
            canCommit={canCommit}
            send={send}
          />
        </div>

        {todos && todos.items.length > 0 ? (
          <>
            <Separator className="my-2.5" />
            <ProgressSection todos={todos} />
          </>
        ) : null}

        {agents.length > 0 ? (
          <>
            <Separator className="my-2.5" />
            <AgentsSection agents={agents} />
          </>
        ) : null}
      </ScrollArea>
    </Card>
  );
}
