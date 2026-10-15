import { Clock, Loader2, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { defaultFilter } from "cmdk";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/lib/i18n";
import {
  useOmpSessionActions,
  type ModelCatalog,
  type ModelOption,
} from "@/features/omp";
import { cn } from "@/lib/utils";
import { ChipTrigger } from "@/components/ui/chip-trigger";

const STORAGE_KEY_FAVORITES = "omp-model-favorites";
const STORAGE_KEY_RECENT = "omp-model-recent";

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavorites(favorites: string[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY_FAVORITES,
      JSON.stringify(favorites)
    );
  } catch {
  }
}

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RECENT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
        .filter((item): item is string => typeof item === "string")
        .slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(recent: string[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY_RECENT,
      JSON.stringify(recent.slice(0, 3))
    );
  } catch {
  }
}

function formatContextWindow(tokens: number | undefined): string | null {
  if (!tokens || tokens <= 0) {
    return null;
  }
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 1_000_000)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return `${tokens}`;
}

interface ModelRowProps {
  option: ModelOption;
  prefix: string;
  isFavorited: boolean;
  onToggleFavorite: (selector: string) => void;
  onSelect: (selector: string) => void;
}

function ModelRow({
  option,
  prefix,
  isFavorited,
  onToggleFavorite,
  onSelect,
}: ModelRowProps) {
  const badgeText = formatContextWindow(option.contextWindow);
  const displayName = option.name || option.selector;
  const keywords = useMemo(
    () =>
      [option.name, option.id, option.provider, option.selector].filter(
        Boolean
      ) as string[],
    [option.name, option.id, option.provider, option.selector]
  );

  return (
    <CommandItem
      value={`${prefix}:${option.selector}`}
      keywords={keywords}
      onSelect={() => onSelect(option.selector)}
      className="cursor-pointer justify-between text-xs"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span className="truncate font-medium text-foreground">
          {displayName}
        </span>
        {badgeText && (
          <span className="shrink-0 rounded bg-muted/70 px-1 py-0.5 font-mono text-ui-xs leading-none text-muted-foreground">
            {badgeText}
          </span>
        )}
      </div>

      <div
        data-slot="command-shortcut"
        className="ml-auto flex shrink-0 items-center"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          aria-label={
            isFavorited
              ? `Remove ${displayName} from favorites`
              : `Add ${displayName} to favorites`
          }
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleFavorite(option.selector);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onToggleFavorite(option.selector);
            }
          }}
        >
          <Star
            className={cn(
              "size-3.5 transition-colors",
              isFavorited
                ? "fill-primary text-primary"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
          />
        </Button>
      </div>
    </CommandItem>
  );
}

export const MODEL_DEFAULT = "model-default";

export interface ModelChooserProps {
  catalog?: ModelCatalog;
  options?: ModelOption[];
  loading?: boolean;
  disabled?: boolean;
  value: string | null;
  className?: string;
  onValueChange?: (selector: string) => void;
  showDefaultOption?: boolean;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}

export function ModelChooser({
  catalog,
  options,
  loading = false,
  disabled = false,
  value,
  className,
  onValueChange,
  showDefaultOption = true,
  side = "top",
  align = "start",
}: ModelChooserProps) {
  const { t } = useTranslation();
  const sessionActions = useOmpSessionActions();

  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  const optionsList = useMemo(() => {
    return catalog?.options ?? options ?? [];
  }, [catalog?.options, options]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setFavorites(readFavorites());
        setRecent(readRecent());
        catalog?.load();
      }
    },
    [catalog]
  );

  const optionsBySelector = useMemo(() => {
    const map = new Map<string, ModelOption>();
    for (const option of optionsList) {
      map.set(option.selector, option);
    }
    return map;
  }, [optionsList]);

  const favoriteOptions = useMemo(() => {
    return favorites
      .map((selector) => optionsBySelector.get(selector))
      .filter((opt): opt is ModelOption => opt !== undefined);
  }, [favorites, optionsBySelector]);

  const recentOptions = useMemo(() => {
    return recent
      .slice(0, 3)
      .map((selector) => optionsBySelector.get(selector))
      .filter((opt): opt is ModelOption => opt !== undefined);
  }, [recent, optionsBySelector]);

  const providerGroups = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    for (const option of optionsList) {
      const provider = option.provider || "other";
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(option);
    }

    for (const provider of Object.keys(groups)) {
      groups[provider].sort((a, b) => {
        const nameA = a.name || a.selector;
        const nameB = b.name || b.selector;
        return nameA.localeCompare(nameB);
      });
    }

    return Object.keys(groups)
      .sort()
      .map((provider) => ({
        provider,
        models: groups[provider],
      }));
  }, [optionsList]);

  const toggleFavorite = useCallback((selector: string) => {
    setFavorites((prev) => {
      const next = prev.includes(selector)
        ? prev.filter((s) => s !== selector)
        : [...prev, selector];
      writeFavorites(next);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (selector: string) => {
      if (selector === MODEL_DEFAULT || selector === "") {
        if (onValueChange) {
          onValueChange(MODEL_DEFAULT);
        } else {
          void sessionActions.setModel("");
        }
        setOpen(false);
        return;
      }

      if (optionsList.some((o) => o.selector === selector)) {
        if (onValueChange) {
          onValueChange(selector);
        } else {
          void sessionActions.setModel(selector);
        }
        setRecent((prev) => {
          const next = [selector, ...prev.filter((s) => s !== selector)].slice(
            0,
            3
          );
          writeRecent(next);
          return next;
        });
        setOpen(false);
      }
    },
    [optionsList, onValueChange, sessionActions]
  );

  const filter = useCallback(
    (itemValue: string, search: string, keywords?: string[]) => {
      const colonIndex = itemValue.indexOf(":");
      const cleanValue =
        colonIndex !== -1 ? itemValue.slice(colonIndex + 1) : itemValue;
      return defaultFilter(cleanValue, search, keywords);
    },
    []
  );

  const initialValue = useMemo(() => {
    if (!value || value === MODEL_DEFAULT) return "default:model-default";
    if (favorites.includes(value)) return `fav:${value}`;
    if (recent.includes(value)) return `recent:${value}`;
    return `model:${value}`;
  }, [value, favorites, recent]);

  const isDefaultSelected = !value || value === MODEL_DEFAULT;
  const selectedOption = !isDefaultSelected ? optionsBySelector.get(value!) : undefined;
  const displayLabel =
    selectedOption?.name ||
    selectedOption?.selector ||
    t("newSession.modelDefault");

  const isLoading =
    (catalog && (catalog.state === "loading" || (catalog.state === "idle" && catalog.options.length === 0))) ||
    (!catalog && loading);
  const isError = catalog?.state === "error" && optionsList.length === 0;
  const isEmpty = !isLoading && !isError && optionsList.length === 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <ChipTrigger
            aria-label={t("workspace.composerModel")}
            className={cn(
              "max-w-44 justify-between cursor-pointer",
              disabled && "cursor-not-allowed opacity-50",
              className
            )}
            disabled={disabled}
            title={value ?? undefined}
            tone="default"
            chevron="down"
            open={open}
            icon={<span className="size-1.5 shrink-0 rounded-full bg-chart-2" />}
            label={displayLabel}
          />
        }
      />

      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className="min-w-64 gap-0 overflow-hidden p-0"
      >
        <Command
          filter={filter}
          defaultValue={initialValue}
          className="p-0"
        >
          <CommandInput
            placeholder={t("workspace.composerModelSearch")}
            autoFocus
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>{t("workspace.composerModelLoading")}</span>
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-xs text-destructive">
                <span>{t("workspace.composerModelError")}</span>
              </div>
            ) : isEmpty ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <span>{t("workspace.composerModelEmpty")}</span>
              </div>
            ) : (
              <>
                <CommandEmpty className="text-xs">
                  {t("workspace.composerModelNoResults")}
                </CommandEmpty>

                {showDefaultOption && (
                  <CommandGroup>
                    <CommandItem
                      value="default:model-default"
                      keywords={["default", "model", t("newSession.modelDefault")]}
                      onSelect={() => handleSelect(MODEL_DEFAULT)}
                      className="cursor-pointer justify-between text-xs"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                        <span className="size-1.5 shrink-0 rounded-full bg-chart-2" />
                        <span className="truncate font-medium text-foreground">
                          {t("newSession.modelDefault")}
                        </span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                )}

                {favoriteOptions.length > 0 && (
                  <CommandGroup
                    heading={
                      <div className="flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                        <Star className="size-3 fill-primary text-primary" />
                        <span>{t("workspace.composerModelFavorites")}</span>
                      </div>
                    }
                  >
                    {favoriteOptions.map((option) => (
                      <ModelRow
                        key={`fav-${option.selector}`}
                        option={option}
                        prefix="fav"
                        isFavorited={true}
                        onToggleFavorite={toggleFavorite}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                )}

                {recentOptions.length > 0 && (
                  <CommandGroup
                    heading={
                      <div className="flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>{t("workspace.composerModelRecent")}</span>
                      </div>
                    }
                  >
                    {recentOptions.map((option) => (
                      <ModelRow
                        key={`recent-${option.selector}`}
                        option={option}
                        prefix="recent"
                        isFavorited={favorites.includes(option.selector)}
                        onToggleFavorite={toggleFavorite}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                )}

                {providerGroups.map((group) => (
                  <CommandGroup
                    key={`provider-${group.provider}`}
                    heading={
                      <div className="uppercase tracking-wider text-muted-foreground">
                        {group.provider.toUpperCase()}
                      </div>
                    }
                  >
                    {group.models.map((option) => (
                      <ModelRow
                        key={`model-${option.selector}`}
                        option={option}
                        prefix="model"
                        isFavorited={favorites.includes(option.selector)}
                        onToggleFavorite={toggleFavorite}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
