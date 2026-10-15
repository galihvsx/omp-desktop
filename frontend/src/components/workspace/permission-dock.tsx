import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { useOmpSession, useOmpSessionActions } from "@/features/omp";

export function PermissionDock() {
  const approval = useOmpSession()?.pendingApproval ?? null;
  const respondApproval = useOmpSessionActions().respondApproval;
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  if (!approval) {
    return null;
  }

  const { id, method, title, options } = approval;

  return (
    <div className="shrink-0 px-3 pb-2">
      <Card size="sm" className="mx-auto w-full max-w-3xl px-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
          <Badge variant="secondary" className="shrink-0">
            {t("workspace.permissionTitle")}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-ui-base font-medium">
            {title}
          </span>
          <span className="min-w-0 max-w-2/5 shrink-0 truncate font-mono text-ui-xs text-muted-foreground">
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
              {t("workspace.permissionApprove")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void respondApproval("false")}
            >
              {t("workspace.permissionDeny")}
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
              placeholder={t("workspace.permissionReplyPlaceholder")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <Button size="sm" type="submit">
              {t("workspace.permissionSubmit")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}