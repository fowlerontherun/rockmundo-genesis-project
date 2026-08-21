import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, Heart, Monitor, Moon, ShieldCheck, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { useWellnessState } from "@/hooks/useWellnessState";
import { StatCard } from "../components/StatCard";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

const DESKTOP_ONLY: Record<string, string> = {
  inventory: "Inventory, equipment and item management",
  wardrobe: "Wardrobe and avatar customisation",
  skills: "Skill tree and XP management",
  education: "Courses, tutors and education setup",
  achievements: "Detailed achievements and rewards",
  settings: "Account and character settings",
};
const clamp = (value: unknown) => Math.max(0, Math.min(100, Number(value ?? 0)));

function DesktopOnly({ section }: { section: string }) {
  const title = DESKTOP_ONLY[section] ?? "Desktop gameplay";
  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Me" title={title} description="This deeper management area is intentionally desktop-only." />
    <MobileSectionCard title="Desktop required" action={<MobileStatusBadge tone="info">Desktop</MobileStatusBadge>}>
      <div className="flex gap-3"><Monitor className="h-6 w-6 text-primary" /><p className="text-sm text-muted-foreground">Mobile is for planning your day, checking outcomes and quick actions rather than duplicating full desktop management.</p></div>
    </MobileSectionCard>
  </MobilePageShell>;
}

function Overview() {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const { userId, profileId } = useActiveProfile();
  const today = useScheduledActivities(new Date(), userId ?? undefined);
  const wellness = useWellnessState(profileId ?? null);
  const now = Date.now();
  const current = (today.data ?? []).find((a) => {
    const start = new Date(a.scheduled_start).getTime();
    const end = new Date(a.scheduled_end).getTime();
    return start <= now && end > now && !["completed", "cancelled", "missed"].includes(a.status);
  });
  const vitals: any = wellness.vitals;
  const name = profile?.display_name || profile?.username || "Player";

  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Me" title={name} description="Current status and lightweight personal actions." />
    <MobileSectionCard title="Current status" action={<MobileStatusBadge tone={current ? "info" : "success"}>{current ? "Busy" : "Available"}</MobileStatusBadge>}>
      {today.isLoading ? <MobileLoadingSkeleton cards={1} /> : today.isError ? <MobileErrorState title="Status unavailable" message="Your current schedule could not be checked." onRetry={() => today.refetch()} /> : <MobileEntityCard title={current?.title ?? "No activity in progress"} subtitle={current ? `Until ${new Date(current.scheduled_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Ready for an ad hoc task or scheduled activity"} icon={<User className="h-5 w-5" />} />}
    </MobileSectionCard>

    {wellness.loading ? <MobileLoadingSkeleton cards={1} /> : wellness.error || !vitals ? <MobileSectionCard title="Vitals unavailable" subtitle="No placeholder values are shown when the server state cannot be loaded." action={<MobileStatusBadge tone="warning">Unavailable</MobileStatusBadge>} /> : <div className="grid grid-cols-3 gap-2">
      <StatCard label="Energy" value={clamp(vitals.energy)} icon={<Zap className="h-4 w-4" />} />
      <StatCard label="Mood" value={clamp(vitals.mood ?? vitals.happiness)} icon={<Moon className="h-4 w-4" />} />
      <StatCard label="Health" value={clamp(vitals.health ?? vitals.physical_health)} icon={<Heart className="h-4 w-4" />} />
    </div>}

    <Button className="min-h-11 w-full" onClick={() => navigate("/mobile/me/wellness")}>Recover / wellness</Button>
    <MobileSectionCard title="Desktop gameplay" subtitle="Complex personal management stays on desktop.">
      <div className="space-y-2">{Object.entries(DESKTOP_ONLY).slice(0, 5).map(([key, title]) => <MobileEntityCard key={key} title={title} icon={<Monitor className="h-5 w-5" />} meta={<MobileStatusBadge>Desktop</MobileStatusBadge>} onPress={() => navigate(`/mobile/me/${key}`)} />)}</div>
    </MobileSectionCard>
  </MobilePageShell>;
}

function Wellness() {
  const { profile } = useGameData();
  const state = useWellnessState(profile?.id ?? null);
  const [performing, setPerforming] = useState<string | null>(null);
  const recovery = useMemo(() => state.catalog.filter((entry) => entry.category === "recovery").slice(0, 6), [state.catalog]);
  const vitals: any = state.vitals;
  const run = async (slug: string) => { setPerforming(slug); try { await state.perform(slug); } finally { setPerforming(null); } };

  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Me" title="Wellness" description="Check your condition and perform quick server-backed recovery actions." />
    {state.loading ? <MobileLoadingSkeleton cards={3} /> : state.error ? <MobileErrorState message={state.error} onRetry={() => state.refresh()} /> : !vitals ? <MobileErrorState title="Wellness unavailable" message="Your current wellness state could not be loaded." onRetry={() => state.refresh()} /> : <>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Energy" value={clamp(vitals.energy)} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Health" value={clamp(vitals.health ?? vitals.physical_health)} icon={<Heart className="h-4 w-4" />} />
        <StatCard label="Mood" value={clamp(vitals.mood ?? vitals.happiness)} icon={<Moon className="h-4 w-4" />} />
      </div>
      {state.supplementalError && <MobileSectionCard title="Some wellness details are unavailable" subtitle="Your core vitals are still current. Optional condition data can be retried without hiding them." action={<Button size="sm" variant="outline" onClick={() => state.refresh()}>Retry</Button>}><p className="text-xs text-muted-foreground">{state.supplementalError}</p></MobileSectionCard>}
      {state.blocks.length > 0 && <MobileSectionCard title="Activity blocks" action={<MobileStatusBadge tone="warning">{state.blocks.length}</MobileStatusBadge>}><div className="space-y-2">{state.blocks.map((block) => <MobileEntityCard key={block.id} title={block.reason} subtitle={`Until ${new Date(block.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} icon={<ShieldCheck className="h-5 w-5" />} />)}</div></MobileSectionCard>}
      <MobileSectionCard title="Recover now" subtitle="Real wellness actions only."><div className="space-y-2">{state.catalogError ? <MobileErrorState message="Recovery actions could not be loaded." onRetry={() => state.refresh()} /> : recovery.length ? recovery.map((entry) => <MobileEntityCard key={entry.id} title={entry.name} subtitle={(entry as any).description || "Quick recovery action"} icon={<Activity className="h-5 w-5" />} meta={<Button size="sm" disabled={performing === entry.slug} onClick={(event) => { event.stopPropagation(); run(entry.slug); }}>{performing === entry.slug ? "Working…" : "Do now"}</Button>} />) : <p className="text-sm text-muted-foreground">No recovery actions are currently available.</p>}</div></MobileSectionCard>
      <MobileSectionCard title="Desktop wellness" subtitle="Long-term lifestyle and detailed condition management remain desktop-only." />
    </>}
  </MobilePageShell>;
}

export default function MobileMe() {
  const { section } = useParams();
  if (!section || section === "overview") return <Overview />;
  if (section === "wellness") return <Wellness />;
  return <DesktopOnly section={section} />;
}