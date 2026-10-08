import { InfoIcon, PaletteIcon, PlugIcon, TypeIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useOmpChatStore } from "@/stores/omp-chat-store";

const UI_FONT_SIZE_KEY = "omp-ui-font-size";
const UI_FONT_SIZE_MIN = 12;
const UI_FONT_SIZE_MAX = 20;
const UI_FONT_SIZE_DEFAULT = 14;

const THEME_ITEMS: Record<string, string> = {
  light: "Terang",
  dark: "Gelap",
  system: "Ikut sistem",
};

const STATUS_LABELS: Record<string, string> = {
  disconnected: "Terputus",
  connecting: "Menghubungkan",
  ready: "Siap",
  busy: "Sibuk",
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const status = useOmpChatStore((s) => s.status);
  const sessionId = useOmpChatStore((s) => s.sessionId);
  const stop = useOmpChatStore((s) => s.stop);

  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem(UI_FONT_SIZE_KEY);
    const parsed =
      stored === null ? UI_FONT_SIZE_DEFAULT : Number.parseInt(stored, 10);
    const base = Number.isFinite(parsed) ? parsed : UI_FONT_SIZE_DEFAULT;
    return Math.min(UI_FONT_SIZE_MAX, Math.max(UI_FONT_SIZE_MIN, base));
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-font-size", `${fontSize}px`);
    localStorage.setItem(UI_FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  const isSessionActive = status === "ready" || status === "busy";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ui-base">
            <PaletteIcon className="size-4" />
            Tampilan
          </CardTitle>
          <CardDescription className="text-ui-sm">
            Pilih tema antarmuka. Pilihan disimpan dan dipakai lagi saat aplikasi
            dibuka.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            items={THEME_ITEMS}
            value={theme}
            onValueChange={(value: unknown) => {
              if (value === "light" || value === "dark" || value === "system") {
                setTheme(value);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{THEME_ITEMS.light}</SelectItem>
              <SelectItem value="dark">{THEME_ITEMS.dark}</SelectItem>
              <SelectItem value="system">{THEME_ITEMS.system}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ui-base">
            <TypeIcon className="size-4" />
            Ukuran teks UI
          </CardTitle>
          <CardDescription className="text-ui-sm">
            Skala text-ui-* mengikuti variabel ini; ukuran ikon dan spasi tidak
            berubah.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ui-sm text-muted-foreground">Ukuran dasar</span>
            <span className="font-mono text-ui-xs">{fontSize}px</span>
          </div>
          <Slider
            min={UI_FONT_SIZE_MIN}
            max={UI_FONT_SIZE_MAX}
            step={1}
            value={fontSize}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") {
                setFontSize(next);
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ui-base">
            <PlugIcon className="size-4" />
            Koneksi
          </CardTitle>
          <CardDescription className="text-ui-sm">
            Status sesi omp yang berjalan di window ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ui-sm text-muted-foreground">Status</span>
            <span className="text-ui-sm font-medium">
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-ui-sm text-muted-foreground">
              ID sesi
            </span>
            <span className="min-w-0 truncate font-mono text-ui-xs">
              {sessionId ?? "—"}
            </span>
          </div>
          {isSessionActive ? (
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void stop()}
              >
                Hentikan sesi
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ui-base">
            <InfoIcon className="size-4" />
            Tentang
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ui-sm text-muted-foreground">
            OMP Desktop — shell Wails untuk CLI omp (--mode rpc). Protokol: JSON
            lines (wire v1), stdout→omp:frame, keluar→omp:rpc-exit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
