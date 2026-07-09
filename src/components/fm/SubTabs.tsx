import { useLocation, useNavigate } from "react-router-dom";
import { findModuleForPath } from "@/config/fmNavigation";
import { cn } from "@/lib/utils";
import { FMQuickActions } from "./FMQuickActions";

export const SubTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mod = findModuleForPath(pathname);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <nav className="h-10 flex items-stretch bg-fm-panel border-b border-fm-border pl-2 pr-2 gap-1" aria-label={`${mod.label} sections`}>
      <div className="flex items-center overflow-x-auto fm-scrollbar-thin min-w-0 flex-1 gap-1">
        {mod.subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "px-3 h-7 flex items-center gap-1.5 text-[12px] font-medium tracking-tight whitespace-nowrap transition-colors rounded-[7px]",
                active
                  ? "text-fm-accent"
                  : "text-fm-fg-muted hover:text-fm-fg",
              )}
              style={active ? { background: "hsl(var(--fm-accent) / 0.15)" } : undefined}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center">
        <FMQuickActions />
      </div>
    </nav>
  );
};

export default SubTabs;
