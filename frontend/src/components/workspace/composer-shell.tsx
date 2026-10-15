import type * as React from "react";

import {
 PromptInput,
 PromptInputFooter,
 PromptInputTextarea,
 PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SendButton } from "@/components/workspace/send-button";

export const COMPOSER_FRAME_CLASS =
 "rounded-xl bg-card p-0 transition-colors focus-within:border-ring";

export type ComposerShellProps = {
 topRow?: React.ReactNode;
 value?: string;
 onChange?: (v: string) => void;
 onSubmit: (text?: string) => void;
 placeholder: string;
 disabled?: boolean;
 sendDisabled?: boolean;
 error?: string;
 leftTools?: React.ReactNode;
 rightTools?: React.ReactNode;
 sendStatus: "ready" | "busy" | "connecting";
 onStop?: () => void;
 labels: { send: string; stop: string };
 variant?: "chat" | "new-session";
 className?: string;
};

export function ComposerShell({
 topRow,
 value,
 onChange,
 onSubmit,
 placeholder,
 disabled = false,
 sendDisabled,
 error,
 leftTools,
 rightTools,
 sendStatus,
 onStop,
 labels,
 variant = "chat",
 className,
}: ComposerShellProps) {
 if (variant === "new-session") {
  return (
   <div
    className={cn(
     "w-full rounded-xl border border-border bg-card p-3 transition-colors focus-within:border-ring",
     className,
    )}
   >
    {topRow ? (
     <div className="flex flex-wrap items-center gap-1.5 pb-2">
      {topRow}
     </div>
    ) : null}

    <Textarea
     aria-invalid={error ? true : undefined}
     className="resize-none border-0 bg-transparent px-1 focus-visible:ring-0 dark:bg-transparent"
     disabled={disabled}
     onChange={(event) => onChange?.(event.target.value)}
     onKeyDown={(event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
       event.preventDefault();
       onSubmit(value);
      }
     }}
     placeholder={placeholder}
     rows={2}
     value={value ?? ""}
    />

    {error ? (
     <p className="px-1 text-ui-xs text-destructive wrap-anywhere">
      {error}
     </p>
    ) : null}

    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
     <div className="flex items-center gap-1.5 flex-wrap">
      {leftTools}
     </div>

     <div className="flex items-center gap-1.5 shrink-0">
      {rightTools}
      <SendButton
       status={sendStatus}
       disabled={sendDisabled ?? disabled}
       onSend={() => onSubmit(value)}
       onStop={onStop}
       labels={labels}
       type="button"
      />
     </div>
    </div>
   </div>
  );
 }

 return (
  <PromptInput
   className={cn(
    COMPOSER_FRAME_CLASS,
    disabled && "opacity-60",
    className,
   )}
   onSubmit={(message) => {
    if (disabled) {
     return;
    }
    const text =
     typeof message.text === "string" ? message.text.trim() : "";
    onSubmit(text || value);
   }}
  >
   {topRow ? (
    <div className="flex flex-wrap items-center gap-1.5 pb-2">
     {topRow}
    </div>
   ) : null}
   <PromptInputTextarea
    disabled={disabled}
    rows={1}
    placeholder={placeholder}
    className="min-h-12 bg-transparent px-3 dark:bg-transparent"
    value={value}
    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
   />
   {error ? (
    <p className="px-1 text-ui-xs text-destructive wrap-anywhere">
     {error}
    </p>
   ) : null}
   <PromptInputFooter className="pt-1">
    <PromptInputTools className="gap-1.5 flex-wrap">
     {leftTools}
    </PromptInputTools>

    <PromptInputTools className="gap-1.5 shrink-0">
     {rightTools}
     <SendButton
      status={sendStatus}
      disabled={sendDisabled ?? disabled}
      onSend={() => onSubmit(value)}
      onStop={onStop}
      labels={labels}
      type="submit"
     />
    </PromptInputTools>
   </PromptInputFooter>
  </PromptInput>
 );
}
