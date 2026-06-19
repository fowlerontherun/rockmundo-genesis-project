import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Home, Search, Plus, ChevronDown } from "lucide-react";
import { findModuleForPath } from "@/config/fmNavigation";
import { getLastModulePath } from "@/lib/fmHistory";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const IconBtn = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "h-6 w-6 grid place-items-center rounded-sm border transition-colors",
      "border-fm-border bg-fm-panel hover:bg-fm-panel-2 hover:border-fm-accent/60",
      disabled && "opacity-40 cursor-not-allowed hover:bg-fm-panel hover:border-fm-border",
      highlight && "text-fm-accent border-fm-accent/50 bg-fm-accent/10",
    )}
  >
    <Icon className="h-3 w-3" />
  </button>
);

export const FMQuickActions = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mod = findModuleForPath(pathname);
  const actions = mod.quickActions ?? [];

  const openSearch = () => {
    window.dispatchEvent(new Event("fm:open-command"));
  };

  return (
    <div className="flex items-center gap-1.5 pl-2 ml-auto flex-shrink-0">
      <IconBtn icon={ArrowLeft} label="Back" onClick={() => window.history.back()} />
      <IconBtn icon={ArrowRight} label="Forward" onClick={() => window.history.forward()} />
      <IconBtn
        icon={Home}
        label={pathname === mod.rootPath ? "Resume last page" : `${mod.label} Hub`}
        onClick={() => {
          if (pathname === mod.rootPath) {
            const last = getLastModulePath(mod.id);
            if (last && last !== mod.rootPath) navigate(last);
          } else {
            navigate(mod.rootPath);
          }
        }}
      />
      <span className="w-px h-4 bg-fm-border mx-0.5" />
      <button
        type="button"
        onClick={openSearch}
        title="Search (⌘K)"
        className="h-6 px-2 flex items-center gap-1.5 rounded-sm border border-fm-border bg-fm-panel hover:bg-fm-panel-2 hover:border-fm-accent/60 text-[10px] uppercase tracking-[0.12em] font-semibold text-fm-fg-muted hover:text-fm-fg transition-colors"
      >
        <Search className="h-3 w-3" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden md:inline-flex h-3.5 px-1 items-center rounded-[2px] bg-fm-border/60 text-[9px] tabular-nums text-fm-fg-muted">⌘K</kbd>
      </button>
      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 pl-1.5 pr-1 flex items-center gap-1 rounded-sm border border-fm-accent/50 bg-fm-accent/15 hover:bg-fm-accent/25 text-fm-accent text-[10px] uppercase tracking-[0.14em] font-bold transition-colors"
              title="Create / quick action"
            >
              <Plus className="h-3 w-3" />
              <span>New</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-fm-panel border-fm-border">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-fm-fg-muted font-semibold">
              {mod.label} · Quick Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-fm-border" />
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <DropdownMenuItem
                  key={a.path + a.label}
                  onSelect={() => navigate(a.path)}
                  className="gap-2 cursor-pointer focus:bg-fm-panel-2"
                >
                  {Icon && (
                    <span className="h-6 w-6 grid place-items-center rounded-sm bg-fm-accent/10 border border-fm-accent/25">
                      <Icon className="h-3 w-3 text-fm-accent" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-fm-fg truncate">{a.label}</span>
                    {a.description && (
                      <span className="block text-[10px] text-fm-fg-muted truncate">{a.description}</span>
                    )}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default FMQuickActions;
