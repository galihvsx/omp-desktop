import { create } from "zustand";
import * as runtime from "../../wailsjs/runtime/runtime";

type TitlebarState = {
  isMaximized: boolean;
  loadIsMaximized: () => Promise<void>;
  toggleMaximized: () => void;
  minimize: () => void;
  quit: () => void;
};

export const useTitlebar = create<TitlebarState>((set) => ({
  isMaximized: false,

  loadIsMaximized: async () => {
    set({ isMaximized: await runtime.WindowIsMaximised() });
  },

  toggleMaximized: () => {
    runtime.WindowToggleMaximise();
    set((state) => ({ isMaximized: !state.isMaximized }));
  },

  minimize: () => {
    runtime.WindowMinimise();
  },

  quit: () => {
    runtime.Quit();
  },
}));

void useTitlebar.getState().loadIsMaximized();
