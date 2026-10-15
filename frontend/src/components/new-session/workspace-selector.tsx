import { useCallback, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n";
import { callPickWorkspaceFolder } from "@/lib/repositories/workspace";
import { cn } from "@/lib/utils";

export type WorkspaceItem = {
  value: string;
  label: string;
};

export interface WorkspaceSelectorProps {
  value: string;
  items: WorkspaceItem[];
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  onValueChange: (value: string) => void;
}

interface WorkspaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  placeholder: string;
}

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/[\\/]+/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function WorkspaceSearch({
  value,
  onChange,
  onEnter,
  placeholder,
}: WorkspaceSearchProps) {
  return (
    <div className="flex h-9 items-center gap-2 px-2">
      <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        autoFocus
        className="h-full border-0 bg-transparent px-0 text-ui-xs shadow-none outline-none focus-visible:border-0 focus-visible:ring-0 placeholder:text-muted-foreground dark:bg-transparent"
      />
    </div>
  );
}

interface WorkspaceRowProps {
  item: WorkspaceItem;
  isActive: boolean;
  onSelect: () => void;
}

function WorkspaceRow({ item, isActive, onSelect }: WorkspaceRowProps) {
  return (
    <button
      type="button"
      title={item.value}
      onClick={onSelect}
      className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-ui-xs text-foreground transition-colors hover:bg-accent text-left outline-none cursor-pointer select-none"
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.label}</span>
      </span>
      {isActive ? (
        <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  );
}

export function WorkspaceSelector({
  value,
  items,
  placeholder,
  disabled = false,
  title,
  className,
  onValueChange,
}: WorkspaceSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeItem = useMemo(
    () =>
      items.find((item) => normalizePath(item.value) === normalizePath(value)) ??
      items.find((item) => item.value === value),
    [items, value],
  );

  const displayLabel = useMemo(() => {
    if (activeItem) return activeItem.label;
    if (value) {
      const parts = value.trim().replace(/[\\/]+$/, "").split(/[\\/]+/);
      return parts[parts.length - 1] || value;
    }
    return placeholder || "";
  }, [activeItem, value, placeholder]);

  const cleanSearch = search.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!cleanSearch) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(cleanSearch) ||
        item.value.toLowerCase().includes(cleanSearch),
    );
  }, [items, cleanSearch]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearch("");
    }
  }, []);

  const handleSelect = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      setOpen(false);
    },
    [onValueChange],
  );

  const handleEnter = useCallback(() => {
    if (filteredItems.length > 0) {
      handleSelect(filteredItems[0].value);
    }
  }, [filteredItems, handleSelect]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const picked = await callPickWorkspaceFolder();
      if (picked && picked.trim().length > 0) {
        onValueChange(picked);
        setOpen(false);
      }
    } catch (error) {
      toast.error(t("common.commandFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [onValueChange, t]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        title={title ?? (value || undefined)}
        className={cn(
          "flex h-7 w-fit min-w-0 max-w-48 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-ui-xs whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <FolderIcon className="size-3 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "truncate",
              !activeItem && !value && "text-muted-foreground",
            )}
          >
            {displayLabel}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-72 gap-0 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-md"
      >
        <WorkspaceSearch
          value={search}
          onChange={setSearch}
          onEnter={handleEnter}
          placeholder={t("newSession.workspaceSearchPlaceholder")}
        />

        <Separator className="-mx-1 my-1" />

        <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-ui-xs text-muted-foreground select-none">
              {t("newSession.workspaceEmpty")}
            </div>
          ) : (
            filteredItems.map((item) => (
              <WorkspaceRow
                key={item.value}
                item={item}
                isActive={
                  normalizePath(item.value) === normalizePath(value) ||
                  item.value === value
                }
                onSelect={() => handleSelect(item.value)}
              />
            ))
          )}
        </div>

        <Separator className="-mx-1 my-1" />

        <button
          type="button"
          onClick={() => void handleOpenFolder()}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-ui-xs text-foreground transition-colors hover:bg-accent text-left outline-none cursor-pointer select-none"
        >
          <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{t("newSession.openFolder")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
