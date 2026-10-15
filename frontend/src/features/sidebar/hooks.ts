import { useSidebarStore } from "./store";
export function useSidebar() {
  const width = useSidebarStore((s) => s.width);
  const isDragging = useSidebarStore((s) => s.isDragging);
  const setWidth = useSidebarStore((s) => s.setWidth);
  const resetWidth = useSidebarStore((s) => s.resetWidth);
  const stepWidth = useSidebarStore((s) => s.stepWidth);
  const setIsDragging = useSidebarStore((s) => s.setIsDragging);
  return { width, isDragging, setWidth, resetWidth, stepWidth, setIsDragging };
}
