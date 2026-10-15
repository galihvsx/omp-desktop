import { useCallback, useState } from "react";
import {
  ArrowUpIcon,
  GitCommitHorizontalIcon,
  GitCommitVerticalIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import type { GitStatus } from "@/features/omp";
import { cn } from "@/lib/utils";
import { GitSummaryRow } from "./git-summary-row";

export interface CommitDialogProps {
  status: GitStatus | null;
  canCommit: boolean;
  send: (prompt: string) => Promise<void>;
  trigger?: React.ReactElement;
}

export function composeCommitPrompt(
  action: "commit" | "commit-and-push" | "push",
  includeUnstaged: boolean,
  message: string
): string {
  if (action === "push") {
    return "Push the current branch to its remote.";
  }

  const staging = includeUnstaged
    ? "Stage all changes, including untracked files."
    : "Use only the currently staged changes.";

  const trimmed = message.trim();
  const commitMsgClause = trimmed
    ? `Commit message:\n\n${trimmed}`
    : "Write the commit message yourself, following the repository's commit style.";

  const commitText = `Commit now. ${staging} ${commitMsgClause}`;

  if (action === "commit-and-push") {
    return `${commitText} Then push the branch to its remote.`;
  }

  return commitText;
}

export function CommitDialog({
  status,
  canCommit,
  send,
  trigger,
}: CommitDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [includeUnstaged, setIncludeUnstaged] = useState(true);

  const branch = status?.branch ?? "";
  const changed = status?.changed ?? 0;
  const insertions = status?.insertions ?? 0;
  const deletions = status?.deletions ?? 0;

  const commitDisabled = !canCommit || changed === 0;
  const commitAndPushDisabled = !canCommit || changed === 0;
  const pushDisabled = !canCommit;

  const handleAction = useCallback(
    (action: "commit" | "commit-and-push" | "push") => {
      const prompt = composeCommitPrompt(action, includeUnstaged, message);
      setOpen(false);
      setMessage("");
      void send(prompt).catch(() => {
      });
    },
    [includeUnstaged, message, send]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!commitDisabled) {
        handleAction("commit");
      }
    }
  };

  const actionItemClasses = cn("w-full justify-between");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          trigger ?? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canCommit}
              title={t("panel.commitHint")}
              aria-label={t("panel.commitDialogTitle")}
              className="mt-1 w-full"
            />
          )
        }
      >
        {!trigger ? (
          <>
            <GitCommitVerticalIcon className="size-3.5" />
            <span>{t("panel.commitOrPush")}</span>
          </>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-104 gap-3"
      >
        <PopoverTitle className="sr-only">
          {t("panel.commitDialogTitle")}
        </PopoverTitle>
        <PopoverDescription className="sr-only">
          {t("panel.commitHint")}
        </PopoverDescription>

        <GitSummaryRow
          branch={branch || t("panel.branchUnknown")}
          insertions={insertions}
          deletions={deletions}
          labels={{
            changes: t("panel.changes"),
            insertions: t("panel.insertions"),
            deletions: t("panel.deletions"),
          }}
        />

        <div className="rounded-md border border-input/60 bg-muted/20 px-2.5 py-2 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("panel.commitMessagePlaceholder")}
            rows={4}
            className="min-h-20 w-full resize-none border-0 bg-transparent p-0 text-ui-sm leading-relaxed placeholder:text-muted-foreground/70 shadow-none outline-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label className="cursor-pointer">
            <Checkbox
              checked={includeUnstaged}
              onCheckedChange={(checked) =>
                setIncludeUnstaged(Boolean(checked))
              }
            />
            <span className="text-ui-sm text-foreground">
              {t("panel.commitIncludeUnstaged")}
            </span>
          </Label>
          <span className="shrink-0 text-ui-xs tabular-nums text-muted-foreground">
            {t("panel.commitFilesCount", { count: changed })}
          </span>
        </div>

        <Separator />

        <div className="flex flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={commitDisabled}
            onClick={() => handleAction("commit")}
            className={actionItemClasses}
          >
            <span className="flex items-center gap-2">
              <span className="flex w-6 shrink-0 items-center justify-center">
                <GitCommitHorizontalIcon className="size-4 text-muted-foreground" />
              </span>
              <span>{t("panel.commitAction")}</span>
            </span>
            <Kbd className="text-ui-xs">Ctrl ↵</Kbd>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={commitAndPushDisabled}
            onClick={() => handleAction("commit-and-push")}
            className={actionItemClasses}
          >
            <span className="flex items-center gap-2">
              <span className="flex w-6 shrink-0 items-center justify-center">
                <GitCommitHorizontalIcon className="size-4 text-muted-foreground" />
                <ArrowUpIcon className="size-3 -ml-1 text-muted-foreground" />
              </span>
              <span>{t("panel.commitActionPush")}</span>
            </span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={pushDisabled}
            onClick={() => handleAction("push")}
            className={actionItemClasses}
          >
            <span className="flex items-center gap-2">
              <span className="flex w-6 shrink-0 items-center justify-center">
                <ArrowUpIcon className="size-4 text-muted-foreground" />
              </span>
              <span>{t("panel.pushAction")}</span>
            </span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
