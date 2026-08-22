import { useEffect, useRef, ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../theme/tokens.css";
import { TopAppBar } from "./TopAppBar";
import { BottomNav } from "./BottomNav";
import { FabMenu } from "./FabMenu";
import { MobileActivityBar } from "./MobileActivityBar";
import { detectDesktopFallback, trackMobileEvent } from "../mobileDiagnostics";

export const MobileShell = ({ children }: { children?: ReactNode }) => {
  const location = useLocation();
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("rm-mobile-root");
    return () => document.documentElement.classList.remove("rm-mobile-root");
  }, []);

  useEffect(() => {
    const startedAt = performance.now();
    trackMobileEvent("mobile_route_viewed", { route: location.pathname });
    const id = window.setTimeout(() => {
      trackMobileEvent("mobile_route_load_completed", {
        route: location.pathname,
        durationBucket: performance.now() - startedAt < 1000 ? "under_1s" : "over_1s",
      });
      detectDesktopFallback(location.pathname);
    }, 0);
    return () => {
      window.clearTimeout(id);
      trackMobileEvent("mobile_route_abandoned", { route: location.pathname });
    };
  }, [location.pathname]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (!location.hash) {
      container.scrollTo({ top: 0, behavior: "auto" });
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const targetId = decodeURIComponent(location.hash.slice(1));
    let attempts = 0;
    let timer = 0;
    const findAndScroll = () => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
      attempts += 1;
      if (attempts < 6) timer = window.setTimeout(findAndScroll, 50);
    };
    timer = window.setTimeout(findAndScroll, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const offline = () => trackMobileEvent("mobile_connection_lost", { category: "connection" });
    const online = () => trackMobileEvent("mobile_connection_restored", { category: "connection" });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  return (
    <div className="rm-mobile min-h-[100dvh] flex flex-col">
      <TopAppBar />
      <main
        ref={scrollRef}
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
