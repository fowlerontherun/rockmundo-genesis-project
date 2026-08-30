import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Home, Search, Plus, ChevronDown } from "lucide-react";
import { findModuleForPath } from "@/config/fmNavigation";
import {
  buildMayorOfficePath,
  getMayorOfficeCityId,
  isMayorOfficePath,
  MAYOR_OFFICE_MODULE_LABEL,
} from "@/config/mayorOfficeNavigation";
import { getLastModulePath } from "@/lib/fmHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { translateFMLabel, translateFMText } from "@/i18n/fm";
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
  const { language } = useTranslation();
  const mod = findModuleForPath(pathname);
  const mayorOffice = isMayorOfficePath(pathname);
  const mayorCityId = getMayorOfficeCityId(pathname);
  const actions = mayorOffice ? [] : (mod.quickActions ?? []);
  const rootPath = mayorOffice && mayorCityId ? buildMayorOfficePath(mayorCityId) : mod.rootPath;
  const moduleLabel = mayorOffice ? MAYOR_OFFICE_MODULE_LABEL : mod.label;
  const translatedModuleLabel = translateFMLabel(language, moduleLabel);

  const openSearch = () => {
    window.dispatchEvent(new Event("fm:open-command"));
  };

  return (
    <div className="flex items-center gap-1.5 pl-2 ml-auto flex-shrink-0">
      <IconBtn icon={ArrowLeft} label={translateFMText(language, "back")} onClick={() => window.history.back()} />
      <IconBtn icon={ArrowRight} label={translateFMText(language, "forward")} onClick={() => window.history.forward()} />
      <IconBtn
        icon={Home}
        label={
          mayorOffice
            ? translateFMText(language, "cityHallOverview")
            : pathname === mod.rootPath
              ? translateFMText(language, "resumeLastPage")
              : translateFMText(language, "moduleHub", { module: translateFMLabel(language, mod.label) })
        }
        onClick={() => {
          if (mayorOffice) {
            navigate(rootPath);
            return;
          }
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
        title={translateFMText(language, "searchNavigationShortcut")}
        className="h-6 px-2 flex items-center gap-1.5 rounded-sm border border-fm-border bg-fm-panel hover:bg-fm-panel-2 hover:border-fm-accent/60 text-[10px] tracking-tight font-medium text-fm-fg-muted hover:text-fm-fg transition-colors"
      >
        <Search className="h-3 w-3" />
        <span className="hidden sm:inline">{translateFMLabel(language, "Search")}</span>
        <kbd className="hidden md:inline-flex h-3.5 px-1 items-center rounded-[2px] bg-fm-border/60 text-[9px] tabular-nums text-fm-fg-muted">⌘K</kbd>
      </button>
      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 pl-1.5 pr-1 flex items-center gap-1 rounded-sm border border-fm-accent/50 bg-fm-accent/15 hover:bg-fm-accent/25 text-fm-accent text-[10px] tracking-tight font-medium transition-colors"
              title={translateFMText(language, "createQuickAction")}
            >
              <Plus className="h-3 w-3" />
              <span>{translateFMText(language, "new")}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-fm-panel border-fm-border">
            <DropdownMenuLabel className="text-[10px] tracking-tight text-fm-fg-muted font-medium">
              {translatedModuleLabel} · {translateFMText(language, "quickActions")}
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
                    <span className="block text-xs font-medium text-fm-fg truncate">{translateFMLabel(language, a.label)}</span>
                    {a.description && (
                      <span className="block text-[10px] text-fm-fg-muted truncate">{translateFMLabel(language, a.description)}</span>
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
