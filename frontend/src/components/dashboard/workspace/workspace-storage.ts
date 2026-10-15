export const EXPANDED_STORAGE_KEY = "omp-nav-expanded-groups";
export const HIDDEN_STORAGE_KEY = "omp-nav-hidden-workspaces";

export function readStoredExpandedGroups(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const stored: Record<string, boolean> = {};
    for (const [path, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        stored[path] = value;
      }
    }
    return stored;
  } catch {
    return {};
  }
}

export function writeStoredExpandedGroups(groups: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(groups));
  } catch {
  }
}

export function readStoredHiddenWorkspaces(): string[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((path): path is string => typeof path === "string");
  } catch {
    return [];
  }
}

export function writeStoredHiddenWorkspaces(paths: string[]): void {
  try {
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(paths));
  } catch {
  }
}
