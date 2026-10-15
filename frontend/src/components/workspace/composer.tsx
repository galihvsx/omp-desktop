import {
  PromptInput,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Plus } from "lucide-react";

import {
  APPROVAL_DEFAULT,
  ComposerApprovalChip,
  ComposerModelSelect,
  ComposerReasoningSelect,
} from "./composer-controls";
import { COMPOSER_FRAME_CLASS } from "./composer-shell";
import { PromptQueue } from "./prompt-queue";
import { SendButton } from "./send-button";
import {
  useModelCatalog,
  useOmpSession,
  useOmpSessionActions,
} from "@/features/omp";

export function Composer() {
  const { t } = useTranslation();
  const runtime = useOmpSession();
  const status = runtime?.status ?? "disconnected";
  const { send, abort } = useOmpSessionActions();
  const catalog = useModelCatalog();

  const model = runtime?.model || runtime?.start.model || null;
  const thinkingLevel = runtime?.thinkingLevel || null;
  const approvalMode = runtime?.start.approvalMode || APPROVAL_DEFAULT;
  const isConflicted = Boolean(
    (runtime as typeof runtime & { sessionInUse?: boolean })?.sessionInUse &&
    status === "disconnected",
  );
  const controlsDisabled =
    status === "disconnected" || status === "connecting" || isConflicted;
  const inputDisabled = status === "connecting" || isConflicted;

  const placeholder = isConflicted
    ? t("workspace.composerPlaceholderConflicted")
    : status === "disconnected"
      ? t("workspace.composerPlaceholderDisconnected")
      : status === "busy"
        ? t("workspace.composerPlaceholderBusy")
        : t("workspace.composerPlaceholder");

  return (
    <div className="shrink-0 p-3 pt-1">
      <div className="mx-auto w-full max-w-3xl">
        <PromptInputProvider>
          <PromptQueue />
          <PromptInput
            className={cn(
              COMPOSER_FRAME_CLASS, ""
            )}
            onSubmit={(message) => {
              if (isConflicted) {
                return;
              }
              const text =
                typeof message.text === "string" ? message.text.trim() : "";
              if (text) {
                void send(text);
              }
            }}
          >
            <PromptInputTextarea
              disabled={inputDisabled}
              rows={1}
              placeholder={placeholder}
              className="min-h-12 bg-transparent px-3 dark:bg-transparent"
            />
            <PromptInputFooter className="pt-1">
              <PromptInputTools className="gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={controlsDisabled}
                  title="Attach"
                >
                  <Plus className="size-4" />
                </Button>

                <ComposerApprovalChip mode={approvalMode} />
              </PromptInputTools>

              <PromptInputTools className="gap-1.5 shrink-0">
                <span className="text-ui-sm text-muted-foreground/60 select-none hidden md:inline">
                  · Enter adds a new line
                </span>

                <ComposerModelSelect
                  catalog={catalog}
                  disabled={controlsDisabled}
                  value={model}
                />
                <ComposerReasoningSelect
                  catalog={catalog}
                  disabled={controlsDisabled}
                  model={model}
                  value={thinkingLevel}
                />

                <SendButton
                  type="submit"
                  status={
                    status === "busy"
                      ? "busy"
                      : status === "connecting"
                        ? "connecting"
                        : "ready"
                  }
                  disabled={inputDisabled}
                  onSend={() => { }}
                  onStop={status === "busy" ? () => void abort() : undefined}
                  labels={{
                    send: t("workspace.composerSend"),
                    stop: t("common.stop"),
                  }}
                />
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  );
}