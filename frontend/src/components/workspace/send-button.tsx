import type * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type SendButtonProps = {
  status: "ready" | "busy" | "connecting";
  disabled?: boolean;
  onSend: () => void;
  onStop?: () => void;
  labels: {
    send: string;
    stop: string;
  };
  className?: string;
  type?: "button" | "submit";
};

export function SendButton({
  status,
  disabled = false,
  onSend,
  onStop,
  labels,
  className,
  type = "button",
}: SendButtonProps) {
  const isStop = status === "busy";

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isStop && onStop) {
      e.preventDefault();
      onStop();
      return;
    }
    if (type !== "submit" || !e.currentTarget.form) {
      onSend();
    }
  };

  return (
    <Button
      type={type}
      size="icon-sm"
      aria-label={
        status === "busy" || status === "connecting"
          ? labels.stop
          : labels.send
      }
      disabled={disabled}
      onClick={handleClick}
      className={className}
    >
      {status === "busy" ? (
        <Square className="size-3 fill-current" />
      ) : status === "connecting" ? (
        <Spinner className="size-3" />
      ) : (
        <ArrowUp className="size-3.5" />
      )}
    </Button>
  );
}
