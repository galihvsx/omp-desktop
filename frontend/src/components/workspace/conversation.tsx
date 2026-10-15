import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceMessage } from "@/components/workspace/message";
import { useTranslation } from "@/lib/i18n";
import {
  readActiveOmpSession,
  readHasEarlier,
  useOmpHasEarlier,
  useOmpSession,
  useOmpSessionActions,
  type OmpMessage,
} from "@/features/omp";
import { MessageCircleIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

const NO_MESSAGES: OmpMessage[] = [];

function EarlierMessagesSentinel({ messages }: { messages: OmpMessage[] }) {
  const { scrollRef, isAtBottom } = useStickToBottomContext();
  const hasEarlier = useOmpHasEarlier();
  const { loadEarlier } = useOmpSessionActions();
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const anchorRef = useRef<{ height: number; loadedFrom: number } | null>(null);

  const pull = useCallback(async () => {
    const container = scrollRef.current;
    const runtime = readActiveOmpSession();
    if (!container || !runtime || loadingRef.current) {
      return;
    }
    if (!readHasEarlier()) {
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    anchorRef.current = {
      height: container.scrollHeight,
      loadedFrom: runtime.loadedFrom,
    };
    try {
      await loadEarlier();
    } finally {
      loadingRef.current = false;
      setLoading(false);
      anchorRef.current = null;
    }
  }, [loadEarlier, scrollRef]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const container = scrollRef.current;
    const runtime = readActiveOmpSession();
    if (!container || !runtime || runtime.loadedFrom === anchor.loadedFrom) {
      return;
    }
    anchorRef.current = null;
    container.scrollTop += container.scrollHeight - anchor.height;
  }, [messages, scrollRef]);

  useEffect(() => {
    if (!hasEarlier) {
      return;
    }
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (isAtBottom) {
          return;
        }
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void pull();
          }
        }
      },
      { root }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasEarlier, isAtBottom, pull, scrollRef]);

  if (!hasEarlier) {
    return null;
  }

  return (
    <div
      ref={sentinelRef}
      className="flex h-6 items-center justify-center"
      data-slot="earlier-messages-sentinel"
    >
      {loading ? <Spinner className="size-4" /> : null}
    </div>
  );
}

export function ConversationTimeline() {
  const { t } = useTranslation();
  const runtime = useOmpSession();
  const messages = runtime?.messages ?? NO_MESSAGES;
  const status = runtime?.status ?? "disconnected";

  if (
    runtime &&
    status === "disconnected" &&
    !runtime.hydrated &&
    runtime.sessionFile !== null
  ) {
    return (
      <Conversation className="min-h-0 flex-1 overflow-x-hidden">
        <ConversationContent className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </ConversationContent>
      </Conversation>
    );
  }

  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        className="flex-1"
        description={t("workspace.conversationEmptyDescription")}
        icon={<MessageCircleIcon className="size-8" />}
        title={t("workspace.conversationEmptyTitle")}
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
    <Conversation className="min-h-0 flex-1 overflow-x-hidden">
      <ConversationContent
        className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4"
        scrollClassName="[overflow-anchor:none]"
      >
        <EarlierMessagesSentinel messages={messages} />
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
