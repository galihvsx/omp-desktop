import { Gauge, Shield } from "lucide-react";

import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "@/components/ai-elements/prompt-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useOmpSessionActions,
  type ModelCatalog,
} from "@/features/omp";
import { useTranslation, type TranslationKey } from "@/lib/i18n";
import { ChipTrigger } from "@/components/ui/chip-trigger";
import { ModelChooser } from "./model-chooser";

export const APPROVAL_DEFAULT = "always-ask";

const APPROVAL_LABEL_KEY: Record<string, TranslationKey> = {
  "always-ask": "newSession.approvalAlwaysAsk",
  write: "newSession.approvalWrite",
  yolo: "newSession.approvalYolo",
};

export function ComposerApprovalChip({ mode }: { mode: string }) {
  const { t } = useTranslation();
  const labelKey = APPROVAL_LABEL_KEY[mode];
  const label = labelKey ? t(labelKey) : mode;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <ChipTrigger
              className="max-w-40 cursor-default"
              tone="default"
              chevron="down"
              icon={
                <Shield aria-hidden="true" className="size-3 text-muted-foreground" />
              }
              label={label}
            />
          }
        />
        <TooltipContent>
          <p>{t("workspace.composerApprovalFixed")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ComposerModelSelect({
  catalog,
  disabled,
  value,
}: {
  catalog: ModelCatalog;
  disabled: boolean;
  value: string | null;
}) {
  return <ModelChooser catalog={catalog} disabled={disabled} value={value} />;
}

export function ComposerReasoningSelect({
  catalog,
  disabled,
  model,
  value,
}: {
  catalog: ModelCatalog;
  disabled: boolean;
  model: string | null;
  value: string | null;
}) {
  const { t } = useTranslation();
  const setThinkingLevel = useOmpSessionActions().setThinkingLevel;

  const selected = model
    ? (catalog.options.find((option) => option.selector === model) ?? null)
    : null;
  const levels = selected?.thinking ?? [];
  const resolved = catalog.state === "ready" || catalog.state === "error";
  const unavailable = !model || (resolved && levels.length === 0);

  const displayLevel = value ?? t("workspace.composerReasoningUnavailable");

  return (
    <PromptInputSelect
      disabled={disabled || unavailable}
      items={levels.map((level) => ({ value: level, label: level }))}
      value={value}
      onOpenChange={(open) => {
        if (open) {
          catalog.load();
        }
      }}
      onValueChange={(next) => {
        const level = typeof next === "string" ? next : "";
        if (levels.includes(level)) {
          void setThinkingLevel(level);
        }
      }}
    >
      <PromptInputSelectTrigger
        render={
          <ChipTrigger
            aria-label={t("newSession.reasoningTitle")}
            className="max-w-34 justify-between"
            disabled={disabled || unavailable}
            title={value ?? undefined}
            tone="default"
            chevron="down"
            icon={<Gauge className="size-3 text-muted-foreground shrink-0" />}
            label={displayLevel}
          />
        }
      />
      <PromptInputSelectContent>
        {catalog.state === "loading" ? (
          <PromptInputSelectItem disabled value="composer-reasoning-loading">
            {t("workspace.composerModelLoading")}
          </PromptInputSelectItem>
        ) : levels.length === 0 ? (
          <PromptInputSelectItem disabled value="composer-reasoning-none">
            {t("workspace.composerReasoningUnavailable")}
          </PromptInputSelectItem>
        ) : (
          levels.map((level) => (
            <PromptInputSelectItem key={level} value={level}>
              {level}
            </PromptInputSelectItem>
          ))
        )}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );
}