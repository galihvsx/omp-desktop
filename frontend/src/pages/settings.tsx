import {
  InfoIcon,
  PlugIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SettingsNavItem } from "@/components/settings/settings-nav-item";
import { SettingsRow } from "@/components/settings/settings-row";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { MonoValue } from "@/components/ui/mono-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  UI_FONT_SIZE_KEY,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  applyUiFontSize,
  readUiFontSize,
} from "@/lib/appearance";
import { LOCALES, isLocale, useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CODE_THEME_OPTIONS, type CodeThemeId, useAppearance } from "@/features/appearance";
import { useOmpSession, useOmpSessionActions } from "@/features/omp";

const LANGUAGE_ITEMS: Record<string, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

type SettingsSection = "general" | "connection" | "about";

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const activeRuntime = useOmpSession();
  const { stopAll } = useOmpSessionActions();
  const status = activeRuntime?.status ?? "disconnected";
  const sessionId = activeRuntime?.sessionFile ?? null;

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");

  const { codeTheme, setCodeTheme, showLineNumbers, setShowLineNumbers } =
    useAppearance();

  const [fontSize, setFontSize] = useState<number>(readUiFontSize);

  useEffect(() => {
    applyUiFontSize(fontSize);
    localStorage.setItem(UI_FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  const isSessionActive = status === "ready" || status === "busy";

  const themeItems: Record<string, string> = {
    light: t("settings.themeLight"),
    dark: t("settings.themeDark"),
    system: t("settings.themeSystem"),
  };

  const codeThemeItems = useMemo(
    () => Object.fromEntries(CODE_THEME_OPTIONS.map((opt) => [opt.id, opt.label])),
    [],
  );

  const statusLabels: Record<string, string> = {
    disconnected: t("settings.statusDisconnected"),
    connecting: t("settings.statusConnecting"),
    ready: t("settings.statusReady"),
    busy: t("settings.statusBusy"),
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <div className="grid grid-cols-[13rem_1fr] gap-10 items-start">
          <nav
            aria-label={t("settings.navLabel")}
            className="sticky top-6 flex flex-col gap-1 select-none"
          >
            <SettingsNavItem
              icon={<SlidersHorizontalIcon className="size-4 shrink-0" />}
              label={t("settings.navGeneral")}
              active={activeSection === "general"}
              onSelect={() => setActiveSection("general")}
            />

            <SettingsNavItem
              icon={<PlugIcon className="size-4 shrink-0" />}
              label={t("settings.navConnection")}
              active={activeSection === "connection"}
              onSelect={() => setActiveSection("connection")}
            />

            <div className="pt-2">
              <Separator className="mb-2" />
              <SettingsNavItem
                icon={<InfoIcon className="size-4 shrink-0" />}
                label={t("settings.about")}
                active={activeSection === "about"}
                onSelect={() => setActiveSection("about")}
              />

              <div className="px-2.5 pt-2 text-ui-sm text-muted-foreground/70 flex flex-col gap-0.5">
                <span className="font-medium text-foreground/80">OMP Desktop</span>
                <span className="font-mono">v0.1.0</span>
              </div>
            </div>
          </nav>

          <main className="flex flex-col gap-6 max-w-160 min-w-0">
            {activeSection === "general" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-ui-base font-semibold text-foreground">
                    {t("settings.generalTitle")}
                  </h2>
                  <p className="text-ui-sm text-muted-foreground">
                    {t("settings.generalDescription")}
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/40 divide-y divide-border/60">
                  <SettingsRow
                    title={t("settings.language")}
                    description={t("settings.languageDescription")}
                    controlClassName="w-52"
                  >
                    <Select
                      items={LANGUAGE_ITEMS}
                      value={locale}
                      onValueChange={(value: unknown) => {
                        if (isLocale(value)) {
                          setLocale(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {LANGUAGE_ITEMS[code]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.appearance")}
                    description={t("settings.appearanceDescription")}
                    controlClassName="w-52"
                  >
                    <Select
                      items={themeItems}
                      value={theme}
                      onValueChange={(value: unknown) => {
                        if (
                          value === "light" ||
                          value === "dark" ||
                          value === "system"
                        ) {
                          setTheme(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">{themeItems.light}</SelectItem>
                        <SelectItem value="dark">{themeItems.dark}</SelectItem>
                        <SelectItem value="system">{themeItems.system}</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.textSize")}
                    description={t("settings.textSizeDescription")}
                    align="start"
                    controlClassName="flex flex-col gap-2 w-52"
                  >
                    <div className="flex items-center justify-between text-ui-xs">
                      <span className="text-muted-foreground">
                        {t("settings.textSizeBase")}
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {fontSize}px
                      </span>
                    </div>
                    <Slider
                      min={UI_FONT_SIZE_MIN}
                      max={UI_FONT_SIZE_MAX}
                      step={1}
                      value={[fontSize]}
                      onValueChange={(value) => {
                        const next = Array.isArray(value) ? value[0] : value;
                        if (typeof next === "number") {
                          setFontSize(next);
                        }
                      }}
                      aria-label={t("settings.textSize")}
                    />
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.codeTheme")}
                    description={t("settings.codeThemeDescription")}
                    align="start"
                    controlClassName="flex flex-col gap-2 w-52"
                  >
                    <Select
                      items={codeThemeItems}
                      value={codeTheme}
                      onValueChange={(val: unknown) => {
                        if (
                          typeof val === "string" &&
                          CODE_THEME_OPTIONS.some((o) => o.id === val)
                        ) {
                          setCodeTheme(val as CodeThemeId);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CODE_THEME_OPTIONS.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="overflow-hidden rounded-md border border-border/70 bg-muted/30 p-2 font-mono text-ui-sm leading-relaxed text-muted-foreground">
                      <div className="text-ui-xs uppercase tracking-wider text-muted-foreground/60 mb-1 select-none font-sans font-medium flex items-center justify-between">
                        <span>{t("settings.preview")}</span>
                        <span className="font-mono lowercase text-ui-xs text-muted-foreground/80">
                          {codeTheme}
                        </span>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre font-mono">
                        <code>
                          {showLineNumbers ? (
                            <>
                              <span className="text-muted-foreground/40 select-none mr-2">
                                1
                              </span>
                              <span className="text-foreground">const</span> agent ={" "}
                              <span className="text-primary font-medium">
                                &quot;omp&quot;
                              </span>
                              ;{"\n"}
                              <span className="text-muted-foreground/40 select-none mr-2">
                                2
                              </span>
                              <span className="text-foreground">async function</span>{" "}
                              run() &#123;{"\n"}
                              <span className="text-muted-foreground/40 select-none mr-2">
                                3
                              </span>
                              {"  "}
                              <span className="text-foreground">return</span>{" "}
                              <span className="text-chart-2">true</span>;{"\n"}
                              <span className="text-muted-foreground/40 select-none mr-2">
                                4
                              </span>
                              &#125;
                            </>
                          ) : (
                            <>
                              <span className="text-foreground">const</span> agent ={" "}
                              <span className="text-primary font-medium">
                                &quot;omp&quot;
                              </span>
                              ;{"\n"}
                              <span className="text-foreground">async function</span>{" "}
                              run() &#123;{"\n"}
                              {"  "}
                              <span className="text-foreground">return</span>{" "}
                              <span className="text-chart-2">true</span>;{"\n"}
                              &#125;
                            </>
                          )}
                        </code>
                      </pre>
                    </div>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.lineNumbers")}
                    description={t("settings.lineNumbersDescription")}
                    controlClassName="flex items-center justify-end"
                  >
                    <Switch
                      checked={showLineNumbers}
                      onCheckedChange={setShowLineNumbers}
                      aria-label={t("settings.lineNumbers")}
                    />
                  </SettingsRow>
                </div>
              </div>
            )}

            {activeSection === "connection" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-ui-base font-semibold text-foreground">
                    {t("settings.connectionTitle")}
                  </h2>
                  <p className="text-ui-sm text-muted-foreground">
                    {t("settings.connectionDescription")}
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/40 divide-y divide-border/60">
                  <SettingsRow
                    title={t("settings.status")}
                    description={t("settings.statusDescription")}
                    controlClassName="flex items-center gap-2"
                  >
                    <span
                      className={cn("size-2 rounded-full", {
                        "bg-primary": status === "ready",
                        "bg-chart-2 animate-pulse":
                          status === "busy" || status === "connecting",
                        "bg-muted-foreground/40": status === "disconnected",
                      })}
                    />
                    <span className="text-ui-sm font-medium text-foreground">
                      {statusLabels[status] ?? status}
                    </span>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.sessionId")}
                    description={t("settings.sessionIdDescription")}
                  >
                    <MonoValue
                      className="max-w-64 truncate inline-block"
                      title={sessionId ?? undefined}
                    >
                      {sessionId ?? "—"}
                    </MonoValue>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.stopAll")}
                    description={t("settings.stopAllDescription")}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void stopAll()}
                      disabled={!isSessionActive}
                    >
                      {t("settings.stopAll")}
                    </Button>
                  </SettingsRow>
                </div>
              </div>
            )}

            {activeSection === "about" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-ui-base font-semibold text-foreground">
                    {t("settings.aboutTitle")}
                  </h2>
                  <p className="text-ui-sm text-muted-foreground">
                    {t("settings.aboutSubtitle")}
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/40 divide-y divide-border/60">
                  <SettingsRow
                    title="OMP Desktop"
                    description={t("settings.aboutDescription")}
                    align="start"
                  >
                    <MonoValue>v0.1.0</MonoValue>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.protocol")}
                    description="JSON lines (wire v1) · stdout → omp:frame, exit → omp:rpc-exit"
                  >
                    <MonoValue>omp --mode rpc</MonoValue>
                  </SettingsRow>

                  <SettingsRow
                    title={t("settings.runtime")}
                    description="Wails v2 (Go 1.25) · React 19 · TypeScript · Vite"
                  >
                    <MonoValue>windows / amd64</MonoValue>
                  </SettingsRow>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
