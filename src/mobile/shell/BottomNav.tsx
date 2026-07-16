import { NavLink, useLocation } from "react-router-dom";
import { Home, Guitar, Users, Globe2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMobileDestination } from "@/mobile/routeRegistry";

export const mobilePrimaryNavItems = [
  { to: "/mobile", label: "Home", icon: Home, exact: true },
  { to: "/mobile/career", label: "Career", icon: Guitar },
  { to: "/mobile/social", label: "Social", icon: Users },
  { to: "/mobile/world", label: "World", icon: Globe2 },
  { to: "/mobile/me", label: "Me", icon: User },
];

export const BottomNav = () => {
  const location = useLocation();
  const activeDestination = getMobileDestination(location.pathname);
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "var(--m-safe-b)" }}
      aria-label="Primary"
    >
      <ul className="flex" style={{ height: "var(--m-nav-h)" }}>
        {mobilePrimaryNavItems.map(({ to, label, icon: Icon, exact }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={exact}
              className={({ isActive }) => {
                const destination = (to.replace("/mobile/", "") || "home") as ReturnType<typeof getMobileDestination>;
                const active = isActive || activeDestination === destination;
                return cn("h-full w-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground");
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
