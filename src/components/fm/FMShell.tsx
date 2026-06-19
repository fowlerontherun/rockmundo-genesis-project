import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { TopStatusBar } from "./TopStatusBar";
import { ModuleTabs } from "./ModuleTabs";
import { SubTabs } from "./SubTabs";
import { FMSidebar } from "./FMSidebar";
import { BottomActionBar } from "./BottomActionBar";
import { ChatDockProvider } from "./chat/ChatDockContext";
import { FMChatDock } from "./chat/FMChatDock";
import { FMCommandPalette } from "./FMCommandPalette";
import { findModuleForPath } from "@/config/fmNavigation";

export const FMShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const mod = findModuleForPath(pathname);

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
      </div>
    </ChatDockProvider>
  );
};

export default FMShell;
