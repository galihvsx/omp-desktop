import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOmpChatStore } from "@/stores/omp-chat-store";

export function PermissionDock() {
  const approval = useOmpChatStore((state) => state.pendingApproval);
  const respondApproval = useOmpChatStore((state) => state.respondApproval);
  const [value, setValue] = useState("");

  if (!approval) {
    return null;
  }

  const { id, method, title, options } = approval;

  return (
    <div className="shrink-0 px-3 pb-2">
      <div className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-3 shadow-md">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
          <Badge variant="secondary" className="shrink-0">
            Persetujuan
          </Badge>
          <span className="min-w-0 flex-1 truncate text-ui-base font-medium">
            {title}
          </span>
          <span className="min-w-0 max-w-[40%] shrink-0 truncate font-mono text-ui-xs text-muted-foreground">
            {id}
          </span>
        </div>

        {method === "select" && options.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => (
              <Button
                key={option}
                size="sm"
                variant="outline"
                onClick={() => void respondApproval(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        ) : method === "confirm" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void respondApproval("true")}>
              Setujui
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void respondApproval("false")}
            >
              Tolak
            </Button>
          </div>
        ) : (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = value.trim();
              if (!trimmed) {
                return;
              }
              setValue("");
              void respondApproval(trimmed);
            }}
          >
            <Input
              autoFocus
              placeholder="Ketik balasan"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <Button size="sm" type="submit">
              Kirim
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
