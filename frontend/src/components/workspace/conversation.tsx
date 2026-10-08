import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { WorkspaceMessage } from "@/components/workspace/message";
import { useOmpChatStore } from "@/stores/omp-chat-store";
import { MessageCircleIcon } from "lucide-react";

export function ConversationTimeline() {
  const messages = useOmpChatStore((state) => state.messages);
  const status = useOmpChatStore((state) => state.status);

  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        className="flex-1"
        description="Kirim pesan untuk menjalankan agen omp lewat jembatan RPC."
        icon={<MessageCircleIcon className="size-8" />}
        title="Belum ada sesi"
      />
    );
  }

  let lastAssistantIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      lastAssistantIndex = index;
      break;
    }
  }

  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((message, index) => (
          <WorkspaceMessage
            key={message.id}
            message={message}
            streaming={status === "busy" && index === lastAssistantIndex}
          />
        ))}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
