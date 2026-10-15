import type { BundledTheme } from "shiki";
import { create } from "zustand";


const CODE_THEME_KEY = "omp-code-theme";
const LINE_NUMBERS_KEY = "omp-code-line-numbers";

export const CODE_THEME_OPTIONS: {
  id: string;
  label: string;
  shiki: [BundledTheme, BundledTheme];
}[] = [
  { id: "github", label: "GitHub", shiki: ["github-light", "github-dark"] },
  { id: "dracula", label: "Dracula", shiki: ["github-light", "dracula"] },
  {
    id: "one-dark-pro",
    label: "One Dark Pro",
    shiki: ["github-light", "one-dark-pro"],
  },
  { id: "nord", label: "Nord", shiki: ["github-light", "nord"] },
  {
    id: "solarized-light",
    label: "Solarized Light",
    shiki: ["solarized-light", "solarized-dark"],
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    shiki: ["github-light", "tokyo-night"],
  },
  { id: "dark-plus", label: "VS Code Dark+", shiki: ["light-plus", "dark-plus"] },
];

export type CodeThemeId = (typeof CODE_THEME_OPTIONS)[number]["id"];

export function codeThemeShiki(id: string): [BundledTheme, BundledTheme] {
  const found = CODE_THEME_OPTIONS.find((option) => option.id === id);
  return found ? found.shiki : CODE_THEME_OPTIONS[0].shiki;
}

function readCodeTheme(): CodeThemeId {
  try {
    const stored = window.localStorage.getItem(CODE_THEME_KEY);
    const known = CODE_THEME_OPTIONS.some((option) => option.id === stored);
    return known ? (stored as CodeThemeId) : "github";
  } catch {
    return "github";
  }
}

function readLineNumbers(): boolean {
  try {
    return window.localStorage.getItem(LINE_NUMBERS_KEY) === "true";
  } catch {
    return false;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
}

interface AppearanceState {
  codeTheme: CodeThemeId;
  showLineNumbers: boolean;
  setCodeTheme: (id: CodeThemeId) => void;
  setShowLineNumbers: (show: boolean) => void;
}

export const useAppearanceStore = create<AppearanceState>()((set) => ({
  codeTheme: readCodeTheme(),
  showLineNumbers: readLineNumbers(),
  setCodeTheme: (codeTheme) => {
    set({ codeTheme });
    write(CODE_THEME_KEY, codeTheme);
  },
  setShowLineNumbers: (showLineNumbers) => {
    set({ showLineNumbers });
    write(LINE_NUMBERS_KEY, showLineNumbers ? "true" : "false");
  },
}));
