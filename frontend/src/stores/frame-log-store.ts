import { create } from "zustand";

import * as runtime from "../../wailsjs/runtime/runtime";

const MAX_FRAMES = 500;
const MAX_LINE_LENGTH = 400;

export interface FrameLogState {
  frames: string[];
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  clear: () => void;
}

export const useFrameLogStore = create<FrameLogState>((set, get) => ({
  frames: [],
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  clear: () => set({ frames: [] }),
}));

function appendFrame(line: string): void {
  const trimmed = line.slice(0, MAX_LINE_LENGTH);
  const frames = [...useFrameLogStore.getState().frames, trimmed];
  const overflow = frames.length - MAX_FRAMES;
  if (overflow > 0) {
    frames.splice(0, overflow);
  }
  useFrameLogStore.setState({ frames });
}

try {
  runtime.EventsOn("omp:frame", (payload: unknown) => {
    const serialized =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    appendFrame(
      typeof serialized === "string" ? serialized : String(payload)
    );
  });
  runtime.EventsOn("omp:rpc-exit", (...args: unknown[]) => {
    const detail = args.find(
      (arg): arg is string => typeof arg === "string" && arg.length > 0,
    );
    appendFrame(`[exit] ${detail ?? "bersih"}`);
  });
} catch {
  // Browser dev without the Wails runtime bridge: frame logging stays empty.
}
