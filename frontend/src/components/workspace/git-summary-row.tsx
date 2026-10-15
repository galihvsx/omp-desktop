import { GitBranchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type GitSummaryRowProps = {
  branch: string;
  insertions: number;
  deletions: number;
  changed?: number;
  labels: {
    changes: string;
    insertions: string;
    deletions: string;
  };
  className?: string;
};

export function GitSummaryRow({
  branch,
  insertions,
  deletions,
  changed,
  labels,
  className,
}: GitSummaryRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span
          className="truncate font-mono text-ui-sm font-medium text-foreground"
          title={branch}
        >
          {branch}
        </span>
        {changed !== undefined ? (
          <span
            className="shrink-0 text-ui-xs tabular-nums text-muted-foreground"
            title={labels.changes}
          >
            {changed} {labels.changes}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 font-mono text-ui-xs font-semibold tabular-nums">
        <span className="text-primary" title={labels.insertions}>
          +{insertions}
        </span>
        <span className="text-destructive" title={labels.deletions}>
          -{deletions}
        </span>
      </div>
    </div>
  );
}
