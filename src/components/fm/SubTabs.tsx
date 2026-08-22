import { useLocation, useNavigate } from "react-router-dom";
import { findModuleForPath } from "@/config/fmNavigation";
import {
  buildMayorOfficePath,
  getMayorOfficeCityId,
  getMayorOfficeSection,
  isMayorOfficePath,
  MAYOR_OFFICE_MODULE_LABEL,
  MAYOR_OFFICE_TABS,
} from "@/config/mayorOfficeNavigation";
import { cn } from "@/lib/utils";
import { FMQuickActions } from "./FMQuickActions";

export const SubTabs = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const mod = findModuleForPath(pathname);
  const mayorOffice = isMayorOfficePath(pathname);
  const mayorCityId = getMayorOfficeCityId(pathname);
  const mayorSection = getMayorOfficeSection(search);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const tabs = mayorOffice && mayorCityId
    ? MAYOR_OFFICE_TABS.map((tab) => ({
        label: tab.label,
        path: buildMayorOfficePath(mayorCityId, tab.section),
        icon: tab.icon,
        active: tab.section === mayorSection,
      }))
    : mod.subTabs.map((tab) => ({
        ...tab,
        active: isActive(tab.path),
      }));

  const label = mayorOffice ? MAYOR_OFFICE_MODULE_LABEL : mod.label;

  return (
    <nav className="h-10 flex items-stretch bg-fm-panel border-b border-fm-border pl-2 pr-2 gap-1" aria-label={`${label} sections`}>
      <div className="flex items-center overflow-x-auto fm-scrollbar-thin min-w-0 flex-1 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "px-3 h-7 flex items-center gap-1.5 text-[12px] font-medium tracking-tight whitespace-nowrap transition-colors rounded-[7px]",
                tab.active
                  ? "text-fm-accent"
                  : "text-fm-fg-muted hover:text-fm-fg",
              )}
              style={tab.active ? { background: "hsl(var(--fm-accent) / 0.15)" } : undefined}
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
