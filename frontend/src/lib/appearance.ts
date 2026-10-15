
export const UI_FONT_SIZE_KEY = "omp-ui-font-size";
export const UI_FONT_SIZE_MIN = 12;
export const UI_FONT_SIZE_MAX = 20;
export const UI_FONT_SIZE_DEFAULT = 14;

export function readUiFontSize(): number {
  try {
    const stored = window.localStorage.getItem(UI_FONT_SIZE_KEY);
    const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);
    const base = Number.isFinite(parsed) ? parsed : UI_FONT_SIZE_DEFAULT;
    return Math.min(UI_FONT_SIZE_MAX, Math.max(UI_FONT_SIZE_MIN, base));
  } catch {
    return UI_FONT_SIZE_DEFAULT;
  }
}

export function applyUiFontSize(size: number): void {
  document.documentElement.style.setProperty("--ui-font-size", `${size}px`);
}

export function applyStoredUiFontSize(): void {
  applyUiFontSize(readUiFontSize());
}

applyStoredUiFontSize();
