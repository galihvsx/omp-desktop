import type { SessionStatus, SessionSummary } from "@/features/omp";

export const LIVE_FIELD_SEPARATOR = "\u0000";
export const LIVE_ENTRY_SEPARATOR = "\n";

export const STATUS_CODE: Record<SessionStatus, string> = {
  disconnected: "d",
  connecting: "c",
  ready: "r",
  busy: "b",
};

export const STATUS_BY_CODE: Record<string, SessionStatus> = {
  d: "disconnected",
  c: "connecting",
  r: "ready",
  b: "busy",
};

export type LiveSession = { sessionFile: string | null; status: SessionStatus };

export function liveSignature(
  sessions: Record<
    string,
    { key: string; sessionFile: string | null; status: SessionStatus }
  >,
): string {
  return Object.values(sessions)
    .map(
      (session) =>
        `${session.key}${LIVE_FIELD_SEPARATOR}${session.sessionFile ?? ""}${LIVE_FIELD_SEPARATOR}${STATUS_CODE[session.status]}`,
    )
    .join(LIVE_ENTRY_SEPARATOR);
}

export function decodeLive(signature: string): Map<string, LiveSession> {
  const live = new Map<string, LiveSession>();
  for (const entry of signature.split(LIVE_ENTRY_SEPARATOR)) {
    if (!entry) {
      continue;
    }
    const [key, file, code] = entry.split(LIVE_FIELD_SEPARATOR);
    live.set(key, {
      sessionFile: file || null,
      status: STATUS_BY_CODE[code] ?? "disconnected",
    });
  }
  return live;
}

export function findLive(
  live: Map<string, LiveSession>,
  session: SessionSummary,
): LiveSession | null {
  for (const [key, runtime] of live) {
    if (
      key === session.id ||
      runtime.sessionFile === session.id ||
      runtime.sessionFile === session.path
    ) {
      return runtime;
    }
  }
  return null;
}
