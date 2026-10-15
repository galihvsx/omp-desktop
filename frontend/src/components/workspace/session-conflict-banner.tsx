import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOmpSession, type SessionRuntime } from "@/features/omp";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ConflictedSessionRuntime {
  sessionInUse?: boolean;
  recheckSessionInUse?: () => Promise<void>;
}

export function SessionConflictBanner() {
  const runtime = useOmpSession() as
    | (SessionRuntime & ConflictedSessionRuntime)
    | null;
  const { t } = useTranslation();
  const [isRechecking, setIsRechecking] = useState(false);

  if (!runtime || !runtime.sessionInUse || runtime.status !== "disconnected") {
    return null;
  }

  const handleReload = async () => {
    if (isRechecking || !runtime.recheckSessionInUse) {
      return;
    }
    setIsRechecking(true);
    try {
      await runtime.recheckSessionInUse();
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <Alert variant="destructive" role="alert" className="shrink-0 text-red-500">
      <AlertTriangle className="size-3.5 shrink-0" />
      <AlertTitle className="text-red-500 font-semibold">
        {t("workspace.sessionConflictTitle")}
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-red-500">
        <span className="text-muted-foreground text-ui-sm">{t("workspace.sessionConflictDescription")}</span>
        <span className="text-muted-foreground text-ui-sm">
          {t("workspace.sessionConflictHint")}
        </span>
      </AlertDescription>

      <AlertAction>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          disabled={isRechecking}
          onClick={handleReload}
          title={t("workspace.sessionConflictReload")}
        >
          <RefreshCw
            className={cn("size-3 shrink-0", isRechecking && "animate-spin")}
          />
          <span>
            {isRechecking
              ? t("workspace.sessionConflictReloading")
              : t("workspace.sessionConflictReload")}
          </span>
        </Button>
      </AlertAction>
    </Alert>
  );
}
