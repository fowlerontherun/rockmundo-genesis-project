import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { findModuleForPath } from "@/config/fmNavigation";
import {
  buildMayorOfficePath,
  getMayorOfficeCityId,
  getMayorOfficeSection,
  isMayorOfficePath,
  MAYOR_OFFICE_MODULE_LABEL,
  MAYOR_OFFICE_SIDEBAR,
} from "@/config/mayorOfficeNavigation";
import { ChevronDown, ChevronRight, Handshake, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/rockmundo-new-logo.png";

const COLLAPSED_KEY = "fm-sidebar-collapsed";
const SUPPORT_OPPORTUNITIES_PATH = "/gigs/advanced/support";

type SidebarItem = {
  label: string;
  path: string;
  icon?: LucideIcon;
  active: boolean;
};

type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

export const FMSidebar = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const mod = findModuleForPath(pathname);
  const mayorOffice = isMayorOfficePath(pathname);
  const mayorCityId = getMayorOfficeCityId(pathname);
  const mayorSection = getMayorOfficeSection(search);

  const groups = useMemo<SidebarGroup[]>(() => {
    if (mayorOffice && mayorCityId) {
      return MAYOR_OFFICE_SIDEBAR.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({
          label: item.label,
          path: buildMayorOfficePath(mayorCityId, item.section),
          icon: item.icon,
          active: item.section === mayorSection,
        })),
      }));
    }

    const sidebarGroups = mod.sidebar.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({
        label: item.label,
        path: item.path,
        icon: item.icon,
        active: pathname === item.path || pathname.startsWith(item.path + "/"),
      })),
    }));

    // Support availability is a first-class Band workflow, so keep it visible in
    // the persistent navigation rather than relying on a Band hub tile that a
    // player may never visit. The route already resolves to the Band module via
    // the /gigs match path.
    if (mod.id === "band-live") {
      const performGroup = sidebarGroups.find((group) => group.label === "Perform");
      if (performGroup && !performGroup.items.some((item) => item.path === SUPPORT_OPPORTUNITIES_PATH)) {
        const myGigsIndex = performGroup.items.findIndex((item) => item.path === "/band/gigs");
        const supportItem: SidebarItem = {
          label: "Support Opportunities",
          path: SUPPORT_OPPORTUNITIES_PATH,
          icon: Handshake,
          active: pathname === SUPPORT_OPPORTUNITIES_PATH || pathname.startsWith(SUPPORT_OPPORTUNITIES_PATH + "/"),
        };
        performGroup.items.splice(myGigsIndex >= 0 ? myGigsIndex + 1 : 0, 0, supportItem as (typeof performGroup.items)[number]);
      }
    }

    return sidebarGroups;
  }, [mayorCityId, mayorOffice, mayorSection, mod.id, mod.sidebar, pathname]);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, true]))
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const group of groups) {
        if (!(group.label in next)) next[group.label] = true;
      }
      return next;
    });
  }, [groups]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  const toggleGroup = (label: string) => setOpenGroups((g) => ({ ...g, [label]: !g[label] }));
  const shellLabel = mayorOffice ? MAYOR_OFFICE_MODULE_LABEL : mod.label;

  return (
    <aside
      className={cn(
        "shrink-0 bg-fm-panel border-r border-fm-border flex flex-col transition-[width] duration-150",
        collapsed ? "w-12" : "w-56"
      )}
    >
      <button
        onClick={() => navigate("/")}
        className="h-11 flex items-center gap-2 px-2.5 border-b border-fm-border hover:bg-fm-panel-2 transition-colors"
        title="Rockmundo home"
        aria-label="Go to Rockmundo home"
      >
        <img src={logo} alt="Rockmundo" className="h-7 w-7 object-contain shrink-0" />
        {!collapsed && (
          <span className="font-bebas text-[18px] tracking-[0.1em] text-fm-fg leading-none">
            ROCKMUNDO
          </span>
        )}
      </button>

      <div className="h-9 flex items-center justify-between px-3 border-b border-fm-border">
        {!collapsed && (
          <span className="text-[12px] font-medium tracking-tight text-fm-fg truncate">
            {shellLabel}
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className="ml-auto p-1 rounded-[6px] hover:bg-fm-panel-2 text-fm-fg-muted"
          title={collapsed ? "Expand" : "Collapse"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1 text-[11px] text-fm-fg-muted hover:text-fm-fg"
                aria-expanded={!!openGroups[group.label]}
              >
                <span>{group.label}</span>
                {openGroups[group.label] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(collapsed || openGroups[group.label]) && (
              <div className="space-y-px px-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      title={collapsed ? item.label : undefined}
                      aria-current={item.active ? "page" : undefined}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-[12px] transition-colors",
                        item.active
                          ? "bg-fm-accent/15 text-fm-accent"
                          : "text-fm-fg-muted hover:text-fm-fg hover:bg-fm-panel-2",
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default FMSidebar;
