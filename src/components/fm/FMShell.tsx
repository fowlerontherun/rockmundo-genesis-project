import { ReactNode } from "react";
import { TopStatusBar } from "./TopStatusBar";
import { ModuleTabs } from "./ModuleTabs";
import { SubTabs } from "./SubTabs";
import { FMSidebar } from "./FMSidebar";
import { BottomActionBar } from "./BottomActionBar";
import { ChatDockProvider } from "./chat/ChatDockContext";
import { FMChatDock } from "./chat/FMChatDock";

export const FMShell = ({ children }: { children: ReactNode }) => {
  return (
    <ChatDockProvider>
      <div className="fm-shell flex flex-col h-screen w-screen overflow-hidden bg-fm-bg text-fm-fg">
        <TopStatusBar />
        <ModuleTabs />
        <SubTabs />
        <div className="flex-1 flex min-h-0">
          <FMSidebar />
          <main className="flex-1 overflow-auto bg-fm-bg">
            <div className="px-3 py-3">{children}</div>
          </main>
        </div>
        <BottomActionBar />
        <FMChatDock />
      </div>
    </ChatDockProvider>
  );
};

export default FMShell;
