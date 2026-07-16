import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Backpack, Bed, Heart, Moon, Settings, Shirt, Trophy, Utensils, User, Wallet, Zap } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { QuickActionCard } from "../components/QuickActionCard";
import { StatCard } from "../components/StatCard";
import { MobileEntityCard, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

export default function MobileMe() {
  const navigate = useNavigate();
  const { profile, xpWallet, activityStatus } = useGameData();
  const displayName = profile?.display_name || profile?.username || "Player";
  const p: any = profile ?? {};
  const avatarUrl = p.avatar_url;
  const energy = Math.max(0, Math.min(100, Number(p.energy ?? 80)));
  const mood = Math.max(0, Math.min(100, Number(p.mood ?? p.happiness ?? 70)));
  const health = Math.max(0, Math.min(100, Number(p.health ?? 85)));
  const stress = Math.max(0, Math.min(100, Number(p.stress ?? 15)));
  const actions = [["Character", <User className="h-5 w-5" />, "/character"], ["Inventory", <Backpack className="h-5 w-5" />, "/inventory"], ["Outfit", <Shirt className="h-5 w-5" />, "/clothing-shop"], ["Achievements", <Trophy className="h-5 w-5" />, "/achievements"], ["Eat", <Utensils className="h-5 w-5" />, "/wellness"], ["Sleep", <Moon className="h-5 w-5" />, "/wellness"], ["Settings", <Settings className="h-5 w-5" />, "/character/profile/edit"]] as const;
  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Me" title="Player overview" description="Vitals, progression, money and character shortcuts." />
    <MobileSectionCard title="Character" action={<MobileStatusBadge tone={(activityStatus as any)?.activity_type ? "info" : "neutral"}>{(activityStatus as any)?.activity_type ? "Busy" : "Free"}</MobileStatusBadge>}>
      <div className="flex items-center gap-3"><Avatar className="h-16 w-16 ring-2 ring-primary/40"><AvatarImage src={avatarUrl} alt={displayName} /><AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="truncate text-xl font-bold">{displayName}</div><div className="text-xs text-muted-foreground">@{profile?.username ?? "player"}</div><div className="mt-2 flex gap-2"><MobileStatusBadge tone="info">Level {(xpWallet as any)?.level ?? p.level ?? 1}</MobileStatusBadge><MobileStatusBadge><Wallet className="mr-1 h-3 w-3" />${Number(p.money ?? p.cash ?? 0).toLocaleString()}</MobileStatusBadge></div></div></div>
    </MobileSectionCard>
    <div className="grid grid-cols-2 gap-2"><StatCard label="Energy" value={energy} icon={<Zap className="h-4 w-4" />} /><StatCard label="Health" value={health} icon={<Heart className="h-4 w-4" />} /><StatCard label="Mood" value={mood} icon={<Moon className="h-4 w-4" />} /><StatCard label="Stress" value={100 - stress} icon={<Bed className="h-4 w-4" />} /></div>
    <section><h2 className="mb-2 px-1 text-[15px] font-bold">Quick actions</h2><div className="grid grid-cols-4 gap-2">{actions.map(([label, icon, to]) => <QuickActionCard key={label} label={label} icon={icon} to={to} />)}</div></section>
    <MobileSectionCard title="Inventory & progress"><div className="space-y-2">{actions.slice(0, 4).map(([label, icon, to]) => <MobileEntityCard key={label} title={label} subtitle="Open details" icon={icon} onPress={() => navigate(to)} />)}<MobileEntityCard title="Current activity" subtitle={(activityStatus as any)?.activity_type ? String((activityStatus as any).activity_type).replace(/_/g, " ") : "No timed activity active"} icon={<Zap className="h-5 w-5" />} onPress={() => navigate("/schedule/current")} /></div></MobileSectionCard>
  </MobilePageShell>;
}
