import { Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FM_MODULES, findModuleForPath } from "@/config/fmNavigation";
import {
  buildMayorOfficePath,
  isMayorOfficePath,
  MAYOR_OFFICE_MODULE_ICON,
  MAYOR_OFFICE_MODULE_LABEL,
} from "@/config/mayorOfficeNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentMayorOffice } from "@/hooks/useCurrentMayorOffice";
import { cn } from "@/lib/utils";

export const ModuleTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useUserRole();
  const { data: mayorOffice } = useCurrentMayorOffice();
  const active = findModuleForPath(pathname);
  const cityHallActive = isMayorOfficePath(pathname);
  const modules = FM_MODULES.filter((m) => (m.primary ?? true) && (m.id !== "admin" || isAdmin()));

  const openModule = (_modId: string, rootPath: string) => {
    // Top-level module tabs always land on the module's overview/hub so the
    // player gets a consistent entry point. Sub-page context is still
    // recoverable via the Quick Actions "Resume last page" shortcut.
    navigate(rootPath);
  };

  const renderCityHall = () => {
    if (!mayorOffice) return null;
    const Icon = MAYOR_OFFICE_MODULE_ICON;
    return (
      <button
        key="city-hall"
        onClick={() => navigate(buildMayorOfficePath(mayorOffice.cityId))}
        aria-current={cityHallActive ? "page" : undefined}
        title={`Manage ${mayorOffice.cityName}`}
        className={cn(
          "relative my-1.5 px-3 flex shrink-0 items-center gap-2 text-[12px] font-medium tracking-tight transition-colors rounded-[7px]",
          cityHallActive
            ? "text-fm-accent"
            : "text-fm-fg-muted hover:text-fm-fg",
        )}
        style={cityHallActive ? { background: "hsl(var(--fm-accent) / 0.15)" } : undefined}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span>{MAYOR_OFFICE_MODULE_LABEL}</span>
      </button>
    );
  };

  return (
    <nav className="h-11 flex items-stretch bg-fm-panel border-b border-fm-border px-2 gap-1 overflow-x-auto fm-scrollbar-thin" aria-label="Primary modules">
      {modules.map((mod) => {
        const Icon = mod.icon;
        const isActive = !cityHallActive && mod.id === active.id;
        return (
          <Fragment key={mod.id}>
            <button
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
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{mod.label}</span>
            </button>
            {mod.id === "world" && renderCityHall()}
          </Fragment>
        );
      })}
    </nav>
  );
};

export default ModuleTabs;
