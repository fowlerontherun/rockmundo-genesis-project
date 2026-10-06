import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Inbox, MessageSquare, Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { getMobileDestination } from "@/mobile/routeRegistry";

export const mobilePrimaryNavItems = [
  { to: "/mobile", label: "Schedule", icon: CalendarDays, exact: true, destination: "schedule" as const },
  { to: "/mobile/inbox", label: "Inbox", icon: Inbox, destination: "inbox" as const },
  { to: "/mobile/chat", label: "Chat", icon: MessageSquare, destination: "chat" as const },
  { to: "/mobile/progression", label: "XP / AP", icon: Sparkles, destination: "progression" as const },
];

export const BottomNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const activeDestination = getMobileDestination(location.pathname);
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border" style={{ paddingBottom: "var(--m-safe-b)" }} aria-label={t("playerControls.primary")}>
      <ul className="flex" style={{ height: "var(--m-nav-h)" }}>
        {mobilePrimaryNavItems.map(({ to, label, icon: Icon, exact, destination }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={exact} className={({ isActive }) => cn("h-full w-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium", isActive || activeDestination === destination ? "text-primary" : "text-muted-foreground")}>
              {({ isActive }) => <><Icon className={cn("h-5 w-5", isActive && "scale-110")} /><span>{label === "Schedule" ? t("nav.schedule") : label === "Inbox" ? t("nav.inbox") : label === "Chat" ? t("playerControls.chat") : "XP / AP"}</span></>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
