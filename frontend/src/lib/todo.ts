
export interface TodoItem {
  text: string;
  status: "pending" | "inProgress" | "completed";
}

export interface TodoList {
  title?: string;
  items: TodoItem[];
}

const SYNTHETIC_PHASE = "Tasks";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textAt(value: Record<string, unknown>, key: string): string | null {
  const raw = value[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

function statusOf(raw: unknown): TodoItem["status"] {
  if (raw === "completed") {
    return "completed";
  }
  if (raw === "in_progress") {
    return "inProgress";
  }
  return "pending";
}

function withTitle(items: TodoItem[], name: string | null): TodoList {
  const list: TodoList = { items };
  if (name && name !== SYNTHETIC_PHASE) {
    list.title = name;
  }
  return list;
}

function fromPhases(value: unknown): TodoList | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const items: TodoItem[] = [];
  let title: string | null = null;
  for (const phase of value) {
    if (!isRecord(phase) || !Array.isArray(phase.tasks)) {
      return null;
    }
    if (title === null) {
      title = textAt(phase, "name");
    }
    for (const task of phase.tasks) {
      if (!isRecord(task)) {
        return null;
      }
      const text = textAt(task, "content") ?? textAt(task, "text");
      if (text === null) {
        return null;
      }
      items.push({ text, status: statusOf(task.status) });
    }
  }
  return items.length > 0 ? withTitle(items, title) : null;
}

function fromItems(value: unknown): TodoList | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const items: TodoItem[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      if (entry.trim().length === 0) {
        return null;
      }
      items.push({ text: entry, status: "pending" });
      continue;
    }
    if (!isRecord(entry)) {
      return null;
    }
    const text = textAt(entry, "text") ?? textAt(entry, "content");
    if (text === null) {
      return null;
    }
    items.push({ text, status: statusOf(entry.status) });
  }
  return withTitle(items, null);
}

function fromInitList(value: unknown): TodoList | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const items: TodoItem[] = [];
  let title: string | null = null;
  for (const entry of value) {
    if (!isRecord(entry) || !Array.isArray(entry.items)) {
      return null;
    }
    if (title === null) {
      title = textAt(entry, "phase") ?? textAt(entry, "name");
    }
    for (const task of entry.items) {
      if (typeof task !== "string" || task.trim().length === 0) {
        return null;
      }
      items.push({ text: task, status: "pending" });
    }
  }
  return items.length > 0 ? withTitle(items, title) : null;
}

function normalize(payload: unknown): TodoList | null {
  if (Array.isArray(payload)) {
    return fromPhases(payload) ?? fromItems(payload);
  }
  if (!isRecord(payload)) {
    return null;
  }
  if ("phases" in payload) {
    return fromPhases(payload.phases);
  }
  if ("details" in payload) {
    const nested = normalize(payload.details);
    if (nested) {
      return nested;
    }
  }
  if ("list" in payload) {
    return fromInitList(payload.list);
  }
  if ("items" in payload) {
    return (
      fromInitList([{ phase: payload.phase, items: payload.items }]) ??
      fromItems(payload.items)
    );
  }
  if ("tasks" in payload) {
    return fromPhases([payload]);
  }
  return null;
}

export function parseTodo(input: unknown, output: unknown): TodoList | null {
  return normalize(output) ?? normalize(input);
}
