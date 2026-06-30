import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { findModuleForPath } from "@/config/fmNavigation";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "fm-sidebar-collapsed";

export const FMSidebar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mod = findModuleForPath(pathname);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(mod.sidebar.map((g) => [g.label, true]))
  );

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  const toggleGroup = (label: string) => setOpenGroups((g) => ({ ...g, [label]: !g[label] }));
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <aside
      className={cn(
        "shrink-0 bg-fm-panel border-r border-fm-border flex flex-col transition-[width] duration-150",
        collapsed ? "w-12" : "w-56"
      )}
    >
      <div className="h-9 flex items-center justify-between px-3 border-b border-fm-border">
        {!collapsed && (
          <span className="text-[12px] font-medium tracking-tight text-fm-fg truncate">
            {mod.label}
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className="ml-auto p-1 rounded-[6px] hover:bg-fm-panel-2 text-fm-fg-muted"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {mod.sidebar.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1 text-[11px] text-fm-fg-muted hover:text-fm-fg"
              >
                <span>{group.label}</span>
                {openGroups[group.label] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(collapsed || openGroups[group.label]) && (
              <div className="space-y-px px-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-[12px] transition-colors",
                        active
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
