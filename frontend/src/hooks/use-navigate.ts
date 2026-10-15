import { create } from "zustand";

export type View =
  | { name: "new-session"; cwd?: string }
  | { name: "conversation"; key: string }
  | { name: "settings" };

type NavigateState = {
  view: View;
  history: View[];
  navigate: (view: View) => void;
  back: () => void;
};

export const useNavigate = create<NavigateState>((set) => ({
  view: { name: "new-session" },
  history: [],

  navigate: (view) =>
    set((state) => ({
      view,
      history: [...state.history, state.view],
    })),

  back: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const history = [...state.history];
      const previous = history.pop()!;
      return { view: previous, history };
    }),
}));
