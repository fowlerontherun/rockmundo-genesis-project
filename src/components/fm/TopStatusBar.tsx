import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import { CharacterSwitcher } from "@/components/character/CharacterSwitcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { RMRadioButton } from "@/components/radio/RMRadioPlayer";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { ActivityStatusIndicator } from "@/components/ActivityStatusIndicator";
import { PrisonStatusIndicator } from "@/components/prison/PrisonStatusIndicator";
import { Button } from "@/components/ui/button";
import { DollarSign, Flame, Heart, Zap, LogOut, User } from "lucide-react";
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
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] border border-fm-border bg-fm-panel-2">
      <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
      <span className="text-[11px] text-fm-fg-muted">{label}</span>
      <span className="text-[12px] font-medium tabular-nums text-fm-fg">{value}</span>
    </div>
  );
};

export const TopStatusBar = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useGameData();
  const { data: calendar } = useGameCalendar();

  const cash = (profile as any)?.cash ?? (profile as any)?.money ?? 0;
  const fame = (profile as any)?.fame ?? 0;
  const health = (profile as any)?.health ?? 100;
  const energy = (profile as any)?.energy ?? 100;
  const name = (profile as any)?.stage_name ?? (profile as any)?.display_name ?? "Artist";

  const dateStr = calendar
    ? `${calendar.gameDay} ${calendar.monthName} ${calendar.gameYear}`
    : "—";

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="h-14 flex items-center gap-3 px-3 bg-fm-panel border-b border-fm-border relative">
      {/* Brand block */}
      <button
        onClick={() => navigate("/")}
        className="group flex items-center gap-2.5 pr-1 -ml-1 pl-1 py-1 rounded-md hover:bg-fm-panel-2 transition-colors"
        title="Rockmundo home"
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
            Live the dream
          </span>
        </div>
      </button>

      <div className="h-7 w-px bg-fm-border" />

      <button
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-fm-panel-2 transition-colors"
        onClick={() => navigate("/hub/character")}
      >
        <User className="h-4 w-4 text-fm-accent" />
        <span className="text-sm font-semibold text-fm-fg">{name}</span>
      </button>

      <div className="h-6 w-px bg-fm-border" />

      <div className="text-[12px] text-fm-fg-muted flex items-center gap-2">
        <span>Game date</span>
        <span className="text-fm-fg font-medium tabular-nums">{dateStr}</span>
      </div>


      <div className="flex-1" />

      <StatPip icon={DollarSign} label="Cash" value={`$${Number(cash).toLocaleString()}`} tone="good" />
      <StatPip icon={Flame} label="Fame" value={Number(fame).toLocaleString()} tone="warn" />
      <StatPip
        icon={Heart}
        label="Health"
        value={`${health}%`}
        tone={health >= 70 ? "good" : health >= 40 ? "warn" : "bad"}
      />
      <StatPip
        icon={Zap}
        label="Energy"
        value={`${energy}%`}
        tone={energy >= 70 ? "good" : energy >= 40 ? "warn" : "bad"}
      />

      <div className="h-6 w-px bg-fm-border mx-1" />

      <CharacterSwitcher />
      <PrisonStatusIndicator />
      <ActivityStatusIndicator />
      <NotificationBell />
      <RMRadioButton />
      <ThemeSwitcher />
      <LanguageSwitcher />
      <HowToPlayDialog />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} title="Sign out">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
};

export default TopStatusBar;
