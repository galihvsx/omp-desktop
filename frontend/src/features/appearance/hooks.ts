import { useAppearanceStore } from "./store";
export function useAppearance() {
  const codeTheme = useAppearanceStore((s) => s.codeTheme);
  const showLineNumbers = useAppearanceStore((s) => s.showLineNumbers);
  const setCodeTheme = useAppearanceStore((s) => s.setCodeTheme);
  const setShowLineNumbers = useAppearanceStore((s) => s.setShowLineNumbers);
  return { codeTheme, showLineNumbers, setCodeTheme, setShowLineNumbers };
}
