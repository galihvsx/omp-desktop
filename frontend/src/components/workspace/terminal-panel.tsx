import { useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

import { Button } from "@/components/ui/button";
import {
 attachTerminalWriter,
 TERMINAL_DEFAULT_DVH,
 TERMINAL_MAX_DVH,
 TERMINAL_MIN_DVH,
 useOmpTerminal,
 useTerminalActions,
 type TerminalTab,
} from "@/features/omp";
import { t as translate, useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function resolveThemeColor(
 host: HTMLElement | null,
 variable: string,
 fallback: string
): string {
 if (typeof document === "undefined") {
  return fallback;
 }
 const scope = host ?? document.documentElement;
 const raw = getComputedStyle(scope).getPropertyValue(variable).trim();
 if (!raw) {
  return fallback;
 }
 const probe = document.createElement("span");
 probe.style.display = "none";
 probe.style.color = `var(${variable})`;
 scope.appendChild(probe);
 const computed = getComputedStyle(probe).color.trim();
 probe.remove();
 if (!computed) {
  return fallback;
 }
 const canvas = document.createElement("canvas");
 const context = canvas.getContext?.("2d");
 if (!context) {
  return fallback;
 }
 canvas.width = 1;
 canvas.height = 1;
 context.fillStyle = computed;
 const normalize = (value: string) => value.replace(/\s+/g, "").toLowerCase();
 if (
  normalize(context.fillStyle) === "#000000" &&
  !/^(?:#0{3}(?:0{3})?|black|rgba?\(0,0,0)/.test(normalize(computed))
 ) {
  return fallback;
 }
 context.fillRect(0, 0, 1, 1);
 const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
 return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function useResolvedTheme(): "dark" | "light" {
 const [theme, setTheme] = useState<"dark" | "light">(() =>
  typeof document !== "undefined" &&
   document.documentElement.classList.contains("dark")
   ? "dark"
   : "light"
 );

 useEffect(() => {
  const root = document.documentElement;
  const sync = () =>
   setTheme(root.classList.contains("dark") ? "dark" : "light");
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
 }, []);

 return theme;
}

function terminalTheme(host: HTMLElement | null, isDark: boolean) {
  return {
    background: resolveThemeColor(
      host,
      "--background",
      isDark ? "#0a0a0a" : "#ffffff"
    ),
    foreground: resolveThemeColor(host, "--foreground", "#e5e5e5"),
    cursor: resolveThemeColor(host, "--foreground", "#e5e5e5"),
    selectionBackground: resolveThemeColor(host, "--muted", "#404040"),
  };
}

interface TerminalSessionProps {
 tab: TerminalTab;
 visible: boolean;
 generation: number;
}

function TerminalSession({ tab, visible, generation }: TerminalSessionProps) {
 const { start, write, resize, shellName } = useTerminalActions();
 const { setShellName } = useOmpTerminal();
 const hostRef = useRef<HTMLDivElement | null>(null);
 const termRef = useRef<Terminal | null>(null);
 const fitRef = useRef<FitAddon | null>(null);
 const resolvedTheme = useResolvedTheme();

 useEffect(() => {
  const host = hostRef.current;
  if (!host) {
   return;
  }

  const isDark = resolvedTheme === "dark";

  const term = new Terminal({
   convertEol: true,
   cursorBlink: true,
   fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
   fontSize: 12,
   scrollback: 5000,
   theme: terminalTheme(host, isDark),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(host);
  if (host.clientWidth > 0 && host.clientHeight > 0) {
   fit.fit();
  }
  termRef.current = term;
  fitRef.current = fit;

  const detach = attachTerminalWriter(tab.id, (chunk) => term.write(chunk));

  const inputSub = term.onData((data) => {
   void write(tab.id, data).catch(() => {
   });
  });

  void start(tab.id, term.cols, term.rows)
   .then(async () => {
    try {
     setShellName(tab.id, await shellName(tab.id));
    } catch {
    }
   })
   .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    term.write(`\r\n${translate("terminal.unavailable")} ${message}\r\n`);
   });

  const observer = new ResizeObserver(() => {
   const current = termRef.current;
   const currentFit = fitRef.current;
   if (!current || !currentFit) {
    return;
   }
   if (host.clientWidth === 0 || host.clientHeight === 0) {
    return;
   }
   currentFit.fit();
   void resize(tab.id, current.cols, current.rows).catch(() => { });
  });
  observer.observe(host);

  return () => {
   observer.disconnect();
   inputSub.dispose();
   detach();
   term.dispose();
   termRef.current = null;
   fitRef.current = null;
  };
 }, [tab.id, generation]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) {
      return;
    }
    term.options.theme = terminalTheme(
      hostRef.current,
      resolvedTheme === "dark"
    );
  }, [resolvedTheme]);

 useEffect(() => {
  if (!visible) {
   return;
  }
  const frame = requestAnimationFrame(() => {
   const term = termRef.current;
   const fit = fitRef.current;
   if (!term || !fit) {
    return;
   }
   fit.fit();
   void resize(tab.id, term.cols, term.rows).catch(() => { });
  });
  return () => cancelAnimationFrame(frame);
 }, [visible, tab.id]);

 return <div ref={hostRef} hidden={!visible} className="h-full w-full" />;
}

export function TerminalPanel() {
 const { t } = useTranslation();
 const { stop } = useTerminalActions();
 const { tabs, activeId, height, setHeight, openTab, closeTab, setActive, clearExited } =
  useOmpTerminal();
 const [generations, setGenerations] = useState<Record<string, number>>({});

 const labels = useMemo(() => {
  const counts = new Map<string, number>();
  const result = new Map<string, string>();
  for (const tab of tabs) {
   const base = tab.shellName || t("terminal.title");
   const seen = (counts.get(base) ?? 0) + 1;
   counts.set(base, seen);
   result.set(tab.id, seen === 1 ? base : `${base} ${seen}`);
  }
  return result;
 }, [tabs, t]);

 if (tabs.length === 0) {
  return null;
 }

 const activeTab = tabs.find((tab) => tab.id === activeId) ?? null;

 const close = (id: string) => {
  setGenerations((previous) => {
   if (!(id in previous)) {
    return previous;
   }
   const next = { ...previous };
   delete next[id];
   return next;
  });
  closeTab(id);
 };

 const restart = () => {
  if (!activeTab) {
   return;
  }
  const id = activeTab.id;
  clearExited(id);
  void stop(id)
   .catch(() => { })
   .then(() =>
    setGenerations((previous) => ({
     ...previous,
     [id]: (previous[id] ?? 0) + 1,
    }))
   );
 };

 const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
  if (event.button !== 0) {
   return;
  }
  event.preventDefault();
  event.currentTarget.focus();
  const startY = event.clientY;
  const startHeight = height;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "row-resize";

  const applyMove = (moveEvent: PointerEvent) => {
   const delta = ((startY - moveEvent.clientY) / window.innerHeight) * 100;
   setHeight(startHeight + delta);
  };
  const stop = () => {
   window.removeEventListener("pointermove", applyMove);
   window.removeEventListener("pointerup", stop);
   window.removeEventListener("pointercancel", stop);
   document.body.style.userSelect = previousUserSelect;
   document.body.style.cursor = "";
  };
  window.addEventListener("pointermove", applyMove);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
 };

 const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
  const step = event.shiftKey ? 5 : 1;
  let next: number | null = null;
  if (event.key === "ArrowUp") {
   next = height + step;
  } else if (event.key === "ArrowDown") {
   next = height - step;
  } else if (event.key === "Home") {
   next = TERMINAL_MIN_DVH;
  } else if (event.key === "End") {
   next = TERMINAL_MAX_DVH;
  }
  if (next !== null) {
   event.preventDefault();
   setHeight(next);
  }
 };

 return (
  <section className="flex shrink-0 flex-col bg-transparent px-3.5 pb-3">
   <div
    role="separator"
    aria-orientation="horizontal"
    aria-label={t("terminal.resize")}
    aria-valuemin={TERMINAL_MIN_DVH}
    aria-valuemax={TERMINAL_MAX_DVH}
    aria-valuenow={height}
    tabIndex={0}
    title={t("terminal.resize")}
    onPointerDown={startResize}
    onDoubleClick={() => setHeight(TERMINAL_DEFAULT_DVH)}
    onKeyDown={handleKeyDown}
    className="group h-2.5 shrink-0 cursor-row-resize touch-none outline-none"
   >
    <div className="mx-6 mt-0.75 h-0.5 rounded-full bg-transparent transition-colors group-hover:bg-foreground/25 group-focus-visible:bg-foreground/40" />
   </div>

   <div className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-zinc-950 shadow-lg dark:border-zinc-800 dark:bg-black">
    <header className="flex select-none items-center gap-2 border-b border-border/40 bg-zinc-900/50 px-3 py-1.5 dark:border-zinc-800/60 dark:bg-zinc-950/80">
     <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => {
       const active = tab.id === activeId;
       const label = labels.get(tab.id) ?? t("terminal.title");
       return (
        <div
         key={tab.id}
         className={cn(
          "flex h-6 min-w-0 max-w-44 shrink-0 items-center gap-1 rounded-md pr-1 pl-2 text-ui-xs transition-colors",
          active
           ? "bg-background text-foreground shadow-xs"
           : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
         )}
        >
         <Button
          type="button"
          variant="ghost"
          size="xs"
          title={label}
          aria-current={active ? "true" : undefined}
          onClick={() => setActive(tab.id)}
          className="h-full min-w-0 flex-1 justify-start text-left"
         >
          {label}
         </Button>
         <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={t("terminal.close")}
          onClick={() => close(tab.id)}
          className="size-4 shrink-0"
         >
          <XIcon className="size-3" />
         </Button>
        </div>
       );
      })}
     </div>
     <Button
      aria-label={t("terminal.newTab")}
      onClick={() => openTab()}
      size="icon-xs"
      variant="ghost"
     >
      <PlusIcon className="size-3.5" />
     </Button>
     {activeTab?.exited ? (
      <span className="min-w-0 shrink truncate text-ui-xs text-destructive">
       {t("terminal.exited")}: {activeTab.exited}
      </span>
     ) : null}
     <Button
      aria-label={t("terminal.restart")}
      onClick={restart}
      size="icon-xs"
      variant="ghost"
     >
      <RotateCcwIcon className="size-3.5" />
     </Button>
     <Button
      aria-label={t("terminal.close")}
      onClick={() => activeTab && close(activeTab.id)}
      size="icon-xs"
      variant="ghost"
     >
      <XIcon className="size-3.5" />
     </Button>
    </header>

    <div
     style={{ height: `${height}dvh` }}
     className="w-full overflow-hidden bg-zinc-950 px-2.5 py-2 dark:bg-black"
    >
     {tabs.map((tab) => (
      <TerminalSession
       key={tab.id}
       tab={tab}
       visible={tab.id === activeId}
       generation={generations[tab.id] ?? 0}
      />
     ))}
    </div>
   </div>
  </section>
 );
}
