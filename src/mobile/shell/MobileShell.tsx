import { useEffect, ReactNode } from "react";
import { Outlet } from "react-router-dom";
import "../theme/tokens.css";
import { TopAppBar } from "./TopAppBar";
import { BottomNav } from "./BottomNav";
import { FabMenu } from "./FabMenu";
import { MobileActivityBar } from "./MobileActivityBar";

export const MobileShell = ({ children }: { children?: ReactNode }) => {
  useEffect(() => {
    document.documentElement.classList.add("rm-mobile-root");
    return () => document.documentElement.classList.remove("rm-mobile-root");
  }, []);

  return (
    <div className="rm-mobile min-h-[100dvh] flex flex-col">
      <TopAppBar />
      <main
        className="rm-mobile-scroll flex-1"
        style={{ paddingBottom: "calc(var(--m-nav-h) + var(--m-safe-b) + 120px)" }}
      >
        <div className="px-3 pt-3 pb-6 space-y-3">
          {children ?? <Outlet />}
        </div>
      </main>
      <MobileActivityBar />
      <FabMenu />
      <BottomNav />
    </div>
  );
};
