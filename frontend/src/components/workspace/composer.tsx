import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Spinner } from "@/components/ui/spinner";
import { useOmpChatStore } from "@/stores/omp-chat-store";

export function Composer() {
  const status = useOmpChatStore((state) => state.status);
  const sendMessage = useOmpChatStore((state) => state.sendMessage);
  const abort = useOmpChatStore((state) => state.abort);

  const placeholder =
    status === "disconnected"
      ? "Kirim pesan untuk memulai sesi omp"
      : status === "busy"
        ? "omp sedang bekerja — hentikan untuk mengetik lebih awal"
        : "Pesan untuk omp…";

  return (
    <div className="shrink-0 p-3">
      <div className="mx-auto w-full max-w-3xl">
        <PromptInput
          onSubmit={(message) => {
            const text =
              typeof message.text === "string" ? message.text.trim() : "";
            if (text) {
              void sendMessage(text);
            }
          }}
        >
          <PromptInputTextarea
            disabled={status === "busy" || status === "connecting"}
            rows={1}
            placeholder={placeholder}
          />
          <PromptInputFooter>
            <PromptInputTools>
              {status === "connecting" ? (
                <>
                  <Spinner />
                  <span className="text-ui-xs text-muted-foreground">
                    Menjalankan omp…
                  </span>
                </>
              ) : status === "busy" ? (
                <>
                  <Spinner />
                  <span className="text-ui-xs text-muted-foreground">
                    omp sedang bekerja…
                  </span>
                </>
              ) : status === "ready" ? (
                <span className="text-ui-xs text-muted-foreground">
                  ⏎ kirim · ⇧⏎ baris baru
                </span>
              ) : (
                <span className="text-ui-xs text-muted-foreground">
                  Sesi belum berjalan
                </span>
              )}
            </PromptInputTools>
            <PromptInputSubmit
              disabled={status === "connecting"}
              status={
                status === "busy"
                  ? "streaming"
                  : status === "connecting"
                    ? "submitted"
                    : "ready"
              }
              onStop={status === "busy" ? () => void abort() : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
