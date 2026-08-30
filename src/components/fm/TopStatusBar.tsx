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
import { DollarSign, Flame, Heart, Zap, LogOut, User, Gauge, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/rockmundo-new-logo.png";

const StatPip = ({ icon: Icon, label, value, tone = "neutral" }: {
  icon: React.ElementType; label: string; value: string | number;
  tone?: "good" | "warn" | "bad" | "neutral";
}) => {
  const toneClass = {
    good: "text-fm-good",
    warn: "text-fm-warn",
    bad: "text-fm-bad",
    neutral: "text-fm-accent",
  }[tone];
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] border border-fm-border bg-fm-panel-2" aria-label={`${label}: ${value}`}>
      <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
      <span className="text-[11px] text-fm-fg-muted">{label}</span>
      <span className="text-[12px] font-medium tabular-nums text-fm-fg">{value}</span>
    </div>
  );
};

const CompactStatPip = ({ icon: Icon, label, value, tone = "neutral", className = "" }: {
  icon: React.ElementType; label: string; value: string | number;
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
    <div
      className={`flex min-w-0 items-center gap-1 rounded-[7px] border border-fm-border bg-fm-panel-2 px-2 py-1 ${className}`}
      aria-label={`${label}: ${value}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClass}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <span className="text-[12px] font-medium tabular-nums text-fm-fg">{value}</span>
    </div>
  );
};

const StatusMenuRow = ({ icon: Icon, label, value, tone = "neutral" }: {
  icon: React.ElementType; label: string; value: string | number;
  tone?: "good" | "warn" | "bad" | "neutral";
}) => {
  const toneClass = {
    good: "text-fm-good",
    warn: "text-fm-warn",
    bad: "text-fm-bad",
    neutral: "text-fm-accent",
  }[tone];

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-1.5">
      <dt className="flex items-center gap-2 text-sm text-fm-fg-muted">
        <Icon className={`h-4 w-4 ${toneClass}`} aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-sm font-medium tabular-nums text-fm-fg">{value}</dd>
    </div>
  );
};

export const TopStatusBar = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, currentCity } = useGameData();
  const { data: calendar } = useGameCalendar();
  const { language } = useTranslation();
  const statusCopy = getFMStatusCopy(language);

  const cash = (profile as any)?.cash ?? (profile as any)?.money ?? 0;
  const fame = (profile as any)?.fame ?? 0;
  const health = (profile as any)?.health ?? 100;
  const energy = (profile as any)?.energy ?? 100;
  const name = (profile as any)?.stage_name ?? (profile as any)?.display_name ?? translateFMText(language, "artist");

  const dateStr = calendar
    ? `${calendar.gameDay} ${calendar.monthName} · Year ${calendar.gameYear}`
    : "—";


  const numberFormatter = new Intl.NumberFormat(statusCopy.locale);
  const cashLabel = statusCopy.cash;
  const fameLabel = statusCopy.fame;
  const healthLabel = statusCopy.health;
  const energyLabel = statusCopy.energy;
  const characterStatus = translateFMText(language, "characterStatus");

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="h-14 flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 bg-fm-panel border-b border-fm-border relative">
      <button
        onClick={() => navigate("/")}
        className="group flex items-center gap-2.5 pr-1 -ml-1 pl-1 py-1 rounded-md hover:bg-fm-panel-2 transition-colors"
        title={translateFMText(language, "rockmundoHome")}
        aria-label={translateFMText(language, "goHome")}
      >
        <img
          src={logo}
          alt="Rockmundo"
          className="h-9 w-auto object-contain drop-shadow-[0_0_8px_hsl(var(--fm-accent)/0.35)]"
        />
        <div className="hidden sm:flex flex-col leading-none text-left">
          <span className="font-bebas text-[22px] tracking-[0.08em] text-fm-fg group-hover:text-fm-accent transition-colors">
            ROCKMUNDO
          </span>
          <span className="text-[9px] tracking-[0.25em] text-fm-fg-muted uppercase mt-0.5" data-fm-keep-caps>
            {translateFMText(language, "liveTheDream")}
          </span>
        </div>
      </button>

      <div className="hidden sm:block h-7 w-px bg-fm-border" />

      <button
        className="flex min-w-0 items-center gap-2 px-2 py-1 rounded hover:bg-fm-panel-2 transition-colors"
        onClick={() => navigate("/hub/character")}
        aria-label={translateFMText(language, "openCharacterHub", { name })}
      >
        <User className="h-4 w-4 shrink-0 text-fm-accent" />
        <span className="max-w-[90px] truncate text-sm font-semibold text-fm-fg sm:max-w-none">{name}</span>
      </button>

      <div className="hidden sm:block h-6 w-px bg-fm-border" />

      <div className="hidden md:flex text-[12px] text-fm-fg-muted items-center gap-2" aria-label={`${translateFMText(language, "gameDate")}: ${dateStr}`}>
        <span>{translateFMText(language, "gameDate")}</span>
        <span className="text-fm-fg font-medium tabular-nums">{dateStr}</span>
      </div>

      <div className="flex-1" />

      <div className="hidden xl:flex items-center gap-1.5" role="group" aria-label={characterStatus}>
        <StatPip icon={DollarSign} label={cashLabel} value={`$${numberFormatter.format(Number(cash))}`} tone="good" />
        <StatPip icon={Flame} label={fameLabel} value={numberFormatter.format(Number(fame))} tone="warn" />
        <StatPip
          icon={Heart}
          label={healthLabel}
          value={`${health}%`}
          tone={health >= 70 ? "good" : health >= 40 ? "warn" : "bad"}
        />
        <StatPip
          icon={Zap}
          label={energyLabel}
          value={`${energy}%`}
          tone={energy >= 70 ? "good" : energy >= 40 ? "warn" : "bad"}
        />
      </div>

      <div className="hidden md:flex xl:hidden items-center gap-1.5" role="group" aria-label={characterStatus}>
        <CompactStatPip icon={DollarSign} label={cashLabel} value={`$${numberFormatter.format(Number(cash))}`} tone="good" className="hidden lg:flex" />
        <CompactStatPip icon={Flame} label={fameLabel} value={numberFormatter.format(Number(fame))} tone="warn" className="hidden lg:flex" />
        <CompactStatPip
          icon={Heart}
          label={healthLabel}
          value={`${health}%`}
          tone={health >= 70 ? "good" : health >= 40 ? "warn" : "bad"}
        />
        <CompactStatPip
          icon={Zap}
          label={energyLabel}
          value={`${energy}%`}
          tone={energy >= 70 ? "good" : energy >= 40 ? "warn" : "bad"}
        />
      </div>

      <div className="xl:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={translateFMText(language, "openCharacterStatus")}
            >
              <Gauge className="h-4 w-4 text-fm-accent" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-fm-border bg-fm-panel text-fm-fg">
            <DropdownMenuLabel>{characterStatus}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <dl aria-label={translateFMText(language, "characterStatusDetails")}>
              <StatusMenuRow icon={DollarSign} label={cashLabel} value={`$${numberFormatter.format(Number(cash))}`} tone="good" />
              <StatusMenuRow icon={Flame} label={fameLabel} value={numberFormatter.format(Number(fame))} tone="warn" />
              <StatusMenuRow
                icon={Heart}
                label={healthLabel}
                value={`${health}%`}
                tone={health >= 70 ? "good" : health >= 40 ? "warn" : "bad"}
              />
              <StatusMenuRow
                icon={Zap}
                label={energyLabel}
                value={`${energy}%`}
                tone={energy >= 70 ? "good" : energy >= 40 ? "warn" : "bad"}
              />
            </dl>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden sm:block h-6 w-px bg-fm-border mx-1" />

      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex h-8 gap-1.5"
          onClick={() => window.dispatchEvent(new Event("fm:open-command"))}
          aria-label={translateFMText(language, "openNavigationSearch")}
          title={translateFMText(language, "searchNavigationShortcut")}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline text-xs">{translateFMLabel(language, "Search")}</span>
          <kbd className="hidden xl:inline rounded border border-fm-border px-1 text-[10px] text-fm-fg-muted">⌘K</kbd>
        </Button>
        <CharacterSwitcher />
        <PrisonStatusIndicator />
        <ActivityStatusIndicator />
        <NotificationBell />
        <div className="hidden sm:block">
          <RMRadioButton />
        </div>
        {/* Language selection stays visible at every breakpoint */}
        <LanguageSwitcher />
        <div className="hidden sm:block">
          <HowToPlayDialog />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleLogout}
          title={translateFMText(language, "signOut")}
          aria-label={translateFMText(language, "signOut")}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};

export default TopStatusBar;
