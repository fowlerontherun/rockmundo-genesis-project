import { useLocation, useNavigate } from "react-router-dom";
import { findModuleForPath } from "@/config/fmNavigation";
import { cn } from "@/lib/utils";

export const SubTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mod = findModuleForPath(pathname);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="h-9 flex items-stretch bg-fm-panel-2 border-b border-fm-border px-2 overflow-x-auto">
      {mod.subTabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "px-3 flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2",
              active
                ? "text-fm-fg border-fm-accent"
                : "text-fm-fg-muted border-transparent hover:text-fm-fg hover:border-fm-border"
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default SubTabs;
