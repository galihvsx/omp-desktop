import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import DashboardLayout from "./components/dashboard/layout";

function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="flex w-full h-dvh">
          <DashboardLayout />
        </div>
      </TooltipProvider>
      <Toaster position="bottom-right" closeButton duration={2000} />
    </ThemeProvider>
  );
}

export default App;
