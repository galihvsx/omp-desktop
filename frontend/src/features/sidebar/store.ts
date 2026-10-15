import { create } from "zustand";


export const SIDEBAR_WIDTH_STORAGE_KEY = "omp-sidebar-width";

export const DEFAULT_SIDEBAR_WIDTH_REM = 16;

export const MIN_SIDEBAR_WIDTH_REM = 12;

export const MAX_SIDEBAR_WIDTH_VIEWPORT_RATIO = 0.25;

export const KEYBOARD_RESIZE_STEP_REM = 1;

export function getRootFontSize(): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return 16;
  }
  const size = parseFloat(
    window.getComputedStyle(document.documentElement).fontSize
  );
  return Number.isFinite(size) && size > 0 ? size : 16;
}

export function remToPx(rem: number): number {
  return Math.round(rem * getRootFontSize());
}

export function pxToRem(px: number): number {
  return px / getRootFontSize();
}

export interface SidebarWidthBounds {
  min: number;
  max: number;
  defaultWidth: number;
}

export function getSidebarWidthBounds(viewportWidth?: number): SidebarWidthBounds {
  const vw =
    viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const max = Math.round(vw * MAX_SIDEBAR_WIDTH_VIEWPORT_RATIO);
  const minBase = remToPx(MIN_SIDEBAR_WIDTH_REM);
  const min = Math.min(minBase, max);
  const defaultBase = remToPx(DEFAULT_SIDEBAR_WIDTH_REM);
  const defaultWidth = Math.min(Math.max(defaultBase, min), max);
  return { min, max, defaultWidth };
}

export function clampSidebarWidth(width: number, viewportWidth?: number): number {
  const { min, max } = getSidebarWidthBounds(viewportWidth);
  return Math.min(Math.max(Math.round(width), min), max);
}

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw) {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return clampSidebarWidth(parsed);
      }
    }
  } catch {
  }
  const { defaultWidth } = getSidebarWidthBounds();
  return defaultWidth;
}

function writeStoredWidth(width: number): void {
  try {
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(Math.round(width))
    );
  } catch {
  }
}

export interface SidebarStoreState {
  width: number;
  isDragging: boolean;
  setWidth: (width: number, persist?: boolean) => void;
  resetWidth: () => void;
  stepWidth: (stepRem: number) => void;
  setIsDragging: (isDragging: boolean) => void;
}

export const useSidebarStore = create<SidebarStoreState>()((set, get) => ({
  width: readStoredWidth(),
  isDragging: false,
  setWidth: (width, persist = true) => {
    const clamped = clampSidebarWidth(width);
    set({ width: clamped });
    if (persist) {
      writeStoredWidth(clamped);
    }
  },
  resetWidth: () => {
    const { defaultWidth } = getSidebarWidthBounds();
    set({ width: defaultWidth });
    writeStoredWidth(defaultWidth);
  },
  stepWidth: (stepRem) => {
    const current = get().width;
    const next = current + remToPx(stepRem);
    const clamped = clampSidebarWidth(next);
    set({ width: clamped });
    writeStoredWidth(clamped);
  },
  setIsDragging: (isDragging) => {
    set({ isDragging });
    if (!isDragging) {
      writeStoredWidth(get().width);
    }
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    const state = useSidebarStore.getState();
    const clamped = clampSidebarWidth(state.width);
    if (clamped !== state.width) {
      useSidebarStore.setState({ width: clamped });
      writeStoredWidth(clamped);
    }
  });
}
