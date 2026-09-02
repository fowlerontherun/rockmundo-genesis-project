import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { useTranslation } from "@/hooks/useTranslation";
import { translateFMLabel, translateFMText } from "@/i18n/fm";
import { getFMStatusCopy } from "@/i18n/fmStatus";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { RMRadioButton } from "@/components/radio/RMRadioPlayer";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";
import { PrisonStatusIndicator } from "@/components/prison/PrisonStatusIndicator";
import { Button } from "@/components/ui/button";
import { DollarSign, Flame, Heart, Zap, LogOut, Search, MapPin, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/rockmundo-new-logo.png";

const CompactStat = ({ icon: Icon, label, value, tone = "neutral", className = "" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "bad" | "neutral";
  className?: string;
}) => {
  const toneClass = {
    good: "text-fm-good",
    warn: "text-fm-warn",
    bad: "text-fm-bad",
    neutral: "text-fm-accent",
  }[tone];

  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-1 ${className}`} aria-label={`${label}: ${value}`} title={`${label}: ${value}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClass}`} aria-hidden="true" />
      <span className="text-[12px] font-medium tabular-nums text-fm-fg">{value}</span>
    </div>
  );
};

const abbreviate = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}b`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (abs >= 100_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return new Intl.NumberFormat().format(value);
};

export const TopStatusBar = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, currentCity } = useGameData();
  const { data: calendar } = useGameCalendar();
  const { language } = useTranslation();
  const statusCopy = getFMStatusCopy(language);

  const cash = Number((profile as any)?.cash ?? (profile as any)?.money ?? 0);
  const fame = Number((profile as any)?.fame ?? 0);
  const health = Number((profile as any)?.health ?? 100);
  const energy = Number((profile as any)?.energy ?? 100);
  const dateStr = calendar ? `${calendar.gameDay} ${calendar.monthName} · Y${calendar.gameYear}` : "—";

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="h-14 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 bg-fm-panel border-b border-fm-border relative">
      {/* World context: brand, date and city only. Character identity lives on the right. */}
      <button
        onClick={() => navigate("/")}
        className="group flex shrink-0 items-center gap-2 pr-1 py-1 rounded-md hover:bg-fm-panel-2 transition-colors"
        title={translateFMText(language, "rockmundoHome")}
        aria-label={translateFMText(language, "goHome")}
      >
        <img src={logo} alt="Rockmundo" className="h-9 w-auto object-contain drop-shadow-[0_0_8px_hsl(var(--fm-accent)/0.35)]" />
        <div className="hidden lg:flex flex-col leading-none text-left">
          <span className="font-bebas text-[22px] tracking-[0.08em] text-fm-fg group-hover:text-fm-accent transition-colors">ROCKMUNDO</span>
          <span className="text-[9px] tracking-[0.25em] text-fm-fg-muted uppercase mt-0.5" data-fm-keep-caps>{translateFMText(language, "liveTheDream")}</span>
        </div>
      </button>

      <div className="hidden md:block h-6 w-px bg-fm-border" />
      <div className="hidden md:flex items-center text-[12px] text-fm-fg-muted" aria-label={`${translateFMText(language, "gameDate")}: ${dateStr}`} title={`${translateFMText(language, "gameDate")}: ${dateStr}`}>
        <span className="text-fm-fg tabular-nums">{dateStr}</span>
      </div>

      {currentCity?.name && (
        <button
          onClick={() => navigate("/world/current-city")}
          className="hidden sm:flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-fm-panel-2"
          title={`${currentCity.name}${currentCity.country ? `, ${currentCity.country}` : ""}`}
          aria-label={`Current city: ${currentCity.name}`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-fm-accent" aria-hidden="true" />
          <span className="max-w-[100px] truncate text-[12px] text-fm-fg">{currentCity.name}</span>
        </button>
      )}

      <div className="flex-1" />

      {/* Glanceable status: flat values, no competing bordered pills. */}
      <div className="hidden sm:flex items-center gap-0.5" role="group" aria-label={translateFMText(language, "characterStatus")}>
        <CompactStat icon={DollarSign} label={statusCopy.cash} value={`$${abbreviate(cash)}`} tone="good" className="hidden xl:flex" />
        <CompactStat icon={Flame} label={statusCopy.fame} value={abbreviate(fame)} tone="warn" className="hidden lg:flex" />
        <CompactStat icon={Heart} label={statusCopy.health} value={`${health}%`} tone={health >= 70 ? "good" : health >= 40 ? "warn" : "bad"} />
        <CompactStat icon={Zap} label={statusCopy.energy} value={`${energy}%`} tone={energy >= 70 ? "good" : energy >= 40 ? "warn" : "bad"} />
      </div>

      <div className="hidden sm:block h-6 w-px bg-fm-border mx-1" />

      {/* Current activity stays prominent because it can block immediate actions. */}
      <PrisonStatusIndicator />
      <ActivityStatusIndicator />

      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex h-8 w-8"
        onClick={() => window.dispatchEvent(new Event("fm:open-command"))}
        aria-label={translateFMText(language, "openNavigationSearch")}
        title={`${translateFMLabel(language, "Search")} · ${translateFMText(language, "searchNavigationShortcut")}`}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="hidden sm:block"><RMRadioButton /></div>
      <NotificationBell />
      <CharacterSwitcher />

      {/* Secondary utilities no longer compete with gameplay status. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options" title="More options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-fm-border bg-fm-panel text-fm-fg">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
            <span className="text-fm-fg-muted">Language</span>
            <LanguageSwitcher />
          </div>
          <DropdownMenuSeparator />
          <div className="px-1 py-1"><HowToPlayDialog /></div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleLogout()} className="gap-2 cursor-pointer">
            <LogOut className="h-4 w-4" />
            {translateFMText(language, "signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default TopStatusBar;
