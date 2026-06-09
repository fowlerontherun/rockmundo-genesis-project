import { useLocation, useNavigate } from "react-router-dom";
import { FM_MODULES, findModuleForPath } from "@/config/fmNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

export const ModuleTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useUserRole();
  const active = findModuleForPath(pathname);
  const modules = FM_MODULES.filter((m) => m.id !== "admin" || isAdmin());

  return (
    <nav className="h-10 flex items-stretch bg-fm-panel border-b border-fm-border px-1">
      {modules.map((mod) => {
        const Icon = mod.icon;
        const isActive = mod.id === active.id;
        return (
          <button
            key={mod.id}
            onClick={() => navigate(mod.rootPath)}
            className={cn(
              "relative px-4 flex items-center gap-2 text-xs uppercase tracking-wider font-semibold transition-colors",
              isActive
                ? "text-fm-accent bg-fm-panel-2"
                : "text-fm-fg-muted hover:text-fm-fg hover:bg-fm-panel-2/60"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{mod.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-fm-accent" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default ModuleTabs;
