import {
  CalendarIcon,
  FileCodeIcon,
  Gauge,
  GitBranchIcon,
  GitCommitIcon,
  Plus,
  Shield,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OptionSelect } from "@/components/new-session/option-select";
import { WorkspaceSelector } from "@/components/new-session/workspace-selector";
import { ComposerShell } from "@/components/workspace/composer-shell";
import { ModelChooser } from "@/components/workspace/model-chooser";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  useBranches,
  useModels,
  useOmpSessionActions,
  useOmpWorkspace,
  type ModelOption,
  type SessionGroup,
} from "@/features/omp";
import { useNavigate } from "@/hooks/use-navigate";
import { t, useTranslation, type TranslationKey } from "@/lib/i18n";

const APP_PROJECT_FOLDER = "omp-desktop";

const APPROVAL_MODES: { value: string; labelKey: TranslationKey }[] = [
  { value: "always-ask", labelKey: "newSession.approvalAlwaysAsk" },
  { value: "write", labelKey: "newSession.approvalWrite" },
  { value: "yolo", labelKey: "newSession.approvalYolo" },
];

const APPROVAL_DEFAULT = "always-ask";

const MODEL_DEFAULT = "model-default";
const THINKING_INHERIT = "thinking-inherit";

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/[\\/]+/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return t("newSession.sessionOpenFailed");
}

function pickWorkspace(
  groups: SessionGroup[],
  hint: string | undefined,
): string {
  if (hint) {
    const known = groups.find(
      (group) => normalizePath(group.path) === normalizePath(hint),
    );
    return known?.path ?? hint;
  }
  const own = groups.find(
    (group) => group.name.toLowerCase() === APP_PROJECT_FOLDER,
  );
  return own?.path ?? groups[0]?.path ?? "";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning! Leave the rest to me.";
  if (hour < 18) return "Good afternoon! Leave the rest to me.";
  return "Good evening! Leave the rest to me.";
}

export default function NewSessionPage() {
  const { view, navigate } = useNavigate();
  const { t } = useTranslation();
  const cwdHint = view.name === "new-session" ? view.cwd : undefined;

  const { groups, loading: groupsLoading } = useOmpWorkspace();
  const { models, loading: modelsLoading } = useModels();
  const actions = useOmpSessionActions();
  const [cwd, setCwd] = useState(cwdHint ?? "");
  const [cwdPicked, setCwdPicked] = useState(false);

  const { branches, loading: branchesLoading } = useBranches(cwd);
  const [branch, setBranch] = useState("");

  const [model, setModel] = useState(MODEL_DEFAULT);
  const [thinking, setThinking] = useState(THINKING_INHERIT);
  const [approval, setApproval] = useState(APPROVAL_DEFAULT);

  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (cwdPicked) return;
    setCwd(pickWorkspace(groups, cwdHint));
  }, [cwdHint, cwdPicked, groups]);

  useEffect(() => {
    setBranch(branches[0] ?? "");
  }, [branches]);

  const selectedModel = useMemo(
    () => models.find((option) => option.selector === model) ?? null,
    [model, models],
  );

  const thinkingOptions = useMemo(
    () => selectedModel?.thinking ?? [],
    [selectedModel],
  );
  const thinkingEnabled = thinkingOptions.length > 0;

  useEffect(() => {
    if (thinking !== THINKING_INHERIT && !thinkingOptions.includes(thinking)) {
      setThinking(THINKING_INHERIT);
    }
  }, [thinking, thinkingOptions]);

  const workspaceItems = useMemo(() => {
    const items = groups.map((group) => ({
      value: group.path,
      label: group.name,
    }));
    const known = items.some(
      (item) => normalizePath(item.value) === normalizePath(cwd),
    );
    if (cwd && !known) {
      const parts = cwd.trim().replace(/[\\/]+$/, "").split(/[\\/]+/);
      items.unshift({ value: cwd, label: parts[parts.length - 1] || cwd });
    }
    return items;
  }, [cwd, groups]);

  const thinkingItems = useMemo(
    () => [
      { value: THINKING_INHERIT, label: t("newSession.thinkingInherit") },
      ...thinkingOptions.map((level) => ({ value: level, label: level })),
    ],
    [thinkingOptions, t],
  );

  const approvalItems = useMemo(
    () =>
      APPROVAL_MODES.map((mode) => ({
        value: mode.value,
        label: t(mode.labelKey),
      })),
    [t],
  );

  const canSubmit = Boolean(cwd) && prompt.trim().length > 0 && !submitting;

  const submit = async (overrideText?: string) => {
    const text = (overrideText ?? prompt).trim();
    if (!text || !cwd || submitting) {
      return;
    }

    const key = "new:" + crypto.randomUUID();
    const start: {
      model?: string;
      thinkingLevel?: string;
      approvalMode?: string;
    } = { approvalMode: approval };
    if (model !== MODEL_DEFAULT) {
      start.model = model;
    }
    if (thinking !== THINKING_INHERIT) {
      start.thinkingLevel = thinking;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      await actions.open({
        key,
        sessionFile: null,
        cwd,
        title: text.replace(/\s+/g, " ").slice(0, 60),
        start,
      });
      await actions.send(text);
      navigate({ name: "conversation", key });
    } catch (error) {
      setSubmitError(describeError(error));
      setSubmitting(false);
    }
  };

  const suggestions = [
    { label: "Weekly Summary", icon: <CalendarIcon className="size-3" />, prompt: "Generate a weekly summary of the recent changes in this repo" },
    { label: "Error Fix", icon: <WrenchIcon className="size-3" />, prompt: "Analyze and fix the latest errors or test failures in this project" },
    { label: "Refactor Code", icon: <FileCodeIcon className="size-3" />, prompt: "Review code structure and suggest clean refactoring improvements" },
    { label: "Git Commit", icon: <GitCommitIcon className="size-3" />, prompt: "Review git status and create clean, atomic commits for the staged changes" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-background p-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 my-auto">
        <h1 className="text-center text-ui-xl font-medium tracking-tight text-foreground select-none">
          {getGreeting()}
        </h1>

        <ComposerShell
          variant="new-session"
          topRow={
            <>
              <WorkspaceSelector
                value={cwd}
                items={workspaceItems}
                placeholder={
                  groupsLoading
                    ? t("newSession.workspaceLoading")
                    : t("newSession.workspaceEmpty")
                }
                disabled={groupsLoading}
                title={cwd || undefined}
                onValueChange={(next) => {
                  setCwdPicked(true);
                  setCwd(next);
                }}
              />

              <OptionSelect
                value={branch}
                items={branches.map((name) => ({ value: name, label: name }))}
                placeholder={
                  branchesLoading
                    ? t("newSession.branchLoading")
                    : t("newSession.notAGitRepo")
                }
                disabled={branchesLoading || branches.length === 0}
                title={branch || undefined}
                icon={<GitBranchIcon className="size-3 text-muted-foreground" />}
                onValueChange={setBranch}
              />
            </>
          }
          value={prompt}
          onChange={setPrompt}
          onSubmit={(text) => void submit(text)}
          placeholder={t("workspace.composerPlaceholder")}
          disabled={submitting}
          sendDisabled={!canSubmit}
          error={submitError || undefined}
          sendStatus={submitting ? "connecting" : "ready"}
          labels={{
            send: t("newSession.send"),
            stop: t("common.stop"),
          }}
          leftTools={
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title="Attach"
              >
                <Plus className="size-4" />
              </Button>

              <OptionSelect
                value={approval}
                items={approvalItems}
                placeholder={t("newSession.approvalPlaceholder")}
                icon={<Shield className="size-3 text-muted-foreground" />}
                onValueChange={setApproval}
              />
            </>
          }
          rightTools={
            <>
              <ModelChooser
                options={models}
                loading={modelsLoading}
                disabled={modelsLoading || models.length === 0}
                value={model}
                onValueChange={setModel}
                showDefaultOption={true}
                side="top"
                align="end"
              />

              <OptionSelect
                value={thinking}
                items={thinkingItems}
                placeholder={t("newSession.thinkingInherit")}
                disabled={!thinkingEnabled}
                icon={<Gauge className="size-3 text-muted-foreground shrink-0" />}
                title={t("newSession.reasoningTitle")}
                onValueChange={setThinking}
              />
            </>
          }
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPrompt(item.prompt);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
          ))}
        </div>

        <p className="flex flex-wrap items-center justify-center gap-1.5 text-ui-sm text-muted-foreground/70 select-none">
          <span>{t("newSession.sendWith")}</span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <span>/</span>
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>
          <span>{t("newSession.newlineHint")}</span>
        </p>
      </div>
    </div>
  );
}