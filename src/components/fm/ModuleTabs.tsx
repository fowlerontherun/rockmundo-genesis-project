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
import { useTranslation } from "@/hooks/useTranslation";
import { translateFMLabel, translateFMText } from "@/i18n/fm";
import { cn } from "@/lib/utils";

export const ModuleTabs = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useUserRole();
  const { data: mayorOffice } = useCurrentMayorOffice();
  const { language } = useTranslation();
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
        title={translateFMText(language, "manageCity", { city: mayorOffice.cityName })}
        className={cn(
          "relative my-1.5 px-3 flex shrink-0 items-center gap-2 text-[12px] font-medium tracking-tight transition-colors rounded-[7px]",
          cityHallActive
            ? "text-fm-accent"
            : "text-fm-fg-muted hover:text-fm-fg",
        )}
        style={cityHallActive ? { background: "hsl(var(--fm-accent) / 0.15)" } : undefined}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span>{translateFMLabel(language, MAYOR_OFFICE_MODULE_LABEL)}</span>
      </button>
    );
  };

  return (
    <nav
      className="h-11 flex items-stretch bg-fm-panel border-b border-fm-border px-2 gap-1 overflow-x-auto fm-scrollbar-thin"
      aria-label={translateFMText(language, "primaryModules")}
    >
      {modules.map((mod) => {
        const Icon = mod.icon;
        const isActive = !cityHallActive && mod.id === active.id;
        const isFeatured = mod.id === "shop";
        return (
          <Fragment key={mod.id}>
            <button
              onClick={() => openModule(mod.id, mod.rootPath)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative my-1.5 px-3 flex shrink-0 items-center gap-2 text-[12px] font-medium tracking-tight transition-colors rounded-[7px]",
                isFeatured && "font-semibold border border-fm-accent/60 text-fm-accent shadow-[0_0_12px_hsl(var(--fm-accent)/0.35)]",
                isActive
                  ? "text-fm-accent"
                  : isFeatured
                    ? "hover:text-fm-accent"
                    : "text-fm-fg-muted hover:text-fm-fg",
              )}
              style={
                isActive
                  ? { background: "hsl(var(--fm-accent) / 0.15)" }
                  : isFeatured
                    ? { background: "hsl(var(--fm-accent) / 0.10)" }
                    : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{translateFMLabel(language, mod.label)}</span>
            </button>

            {mod.id === "world" && renderCityHall()}
          </Fragment>
        );
      })}
    </nav>
  );
};

export default ModuleTabs;
