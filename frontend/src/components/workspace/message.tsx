import { MessageResponse } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Spinner } from "@/components/ui/spinner";
import { ToolCard } from "@/components/workspace/tool-card";
import type {
  OmpMessage,
  OmpMessagePart,
  OmpTextPart,
} from "@/stores/omp-chat-store";
import { BotIcon } from "lucide-react";

const isTextPart = (part: OmpMessagePart): part is OmpTextPart =>
  part.type === "text";

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
      <div className="max-w-[75%] self-end whitespace-pre-wrap rounded-2xl bg-secondary px-3 py-2 text-ui-base">
        {text}
      </div>
    );
  }

  const lastIndex = message.parts.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-ui-caption text-muted-foreground">
        <BotIcon className="size-3.5" />
        <span>omp</span>
        {streaming ? <Spinner className="size-3" /> : null}
      </div>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return <MessageResponse key={index}>{part.text}</MessageResponse>;
        }

        if (part.type === "reasoning") {
          return (
            <Reasoning key={index} isStreaming={streaming && index === lastIndex}>
              <ReasoningTrigger />
              <ReasoningContent className="font-light text-muted-foreground">
                {part.text}
              </ReasoningContent>
            </Reasoning>
          );
        }

        return <ToolCard key={part.toolCallId} part={part} />;
      })}
    </div>
  );
}
