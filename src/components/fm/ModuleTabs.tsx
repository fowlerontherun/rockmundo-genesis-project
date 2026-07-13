import { useLocation, useNavigate } from "react-router-dom";
import { FM_MODULES, findModuleForPath } from "@/config/fmNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { getLastModulePath } from "@/lib/fmHistory";
import { cn } from "@/lib/utils";

export const ModuleTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useUserRole();
  const active = findModuleForPath(pathname);
  const modules = FM_MODULES.filter((m) => m.id !== "admin" || isAdmin());

  const openModule = (modId: string, rootPath: string) => {
    // Restore the player's last context inside this module if we have one,
    // otherwise fall back to its hub. Don't restore for the already-active
    // module — that becomes a no-op or jumps the user unexpectedly.
    if (modId === active.id) {
      navigate(rootPath);
      return;
    }
    const last = modId === "character" ? null : getLastModulePath(modId);
    navigate(last || rootPath);
  };

  return (
    <nav className="h-11 flex items-stretch bg-fm-panel border-b border-fm-border px-2 gap-1 overflow-x-auto fm-scrollbar-thin" aria-label="Primary modules">
      {modules.map((mod) => {
        const Icon = mod.icon;
        const isActive = mod.id === active.id;
        return (
          <button
            key={mod.id}
            onClick={() => openModule(mod.id, mod.rootPath)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative my-1.5 px-3 flex shrink-0 items-center gap-2 text-[12px] font-medium tracking-tight transition-colors rounded-[7px]",
              isActive
                ? "text-fm-accent"
                : "text-fm-fg-muted hover:text-fm-fg",
            )}
            style={isActive ? { background: "hsl(var(--fm-accent) / 0.15)" } : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{mod.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default ModuleTabs;
