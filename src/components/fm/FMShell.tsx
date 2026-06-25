import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { TopStatusBar } from "./TopStatusBar";
import { ModuleTabs } from "./ModuleTabs";
import { SubTabs } from "./SubTabs";
import { FMSidebar } from "./FMSidebar";
import { BottomActionBar } from "./BottomActionBar";
import { ChatDockProvider } from "./chat/ChatDockContext";
import { FMChatDock } from "./chat/FMChatDock";
import { FMCommandPalette } from "./FMCommandPalette";
import { BugReportButton } from "@/components/bug-report/BugReportButton";
import { findModuleForPath } from "@/config/fmNavigation";
import { recordModulePath } from "@/lib/fmHistory";

export const FMShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const mod = findModuleForPath(pathname);

  // Persist the most recent path inside each module so ModuleTabs and
  // the Quick Actions Home button can restore the player's last context.
  useEffect(() => {
    recordModulePath(mod.id, pathname);
  }, [mod.id, pathname]);

  return (
    <ChatDockProvider>
      <div
        data-fm-module={mod.id}
        className="fm-shell fm-module-themed flex flex-col h-screen w-screen overflow-hidden bg-fm-bg text-fm-fg"
      >
        <TopStatusBar />
        <ModuleTabs />
        <SubTabs />
        <div className="flex-1 flex min-h-0">
          <FMSidebar />
          <main className="relative flex-1 overflow-auto bg-fm-bg">
            {/* Themed background layer — module-specific, low opacity */}
            <div aria-hidden className="fm-module-bg pointer-events-none absolute inset-0" />
            <div className="relative px-4 py-3 max-w-[1800px] mx-auto w-full">{children}</div>
          </main>
        </div>
        <BottomActionBar />
        <FMChatDock />
        <FMCommandPalette />
        <BugReportButton />
      </div>
    </ChatDockProvider>
  );
};

export default FMShell;
