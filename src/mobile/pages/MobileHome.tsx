import { AlertTriangle, CalendarDays, CalendarPlus, Clock3, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useGameData } from "@/hooks/useGameData";
import { DailyStipendCard } from "@/components/attributes/DailyStipendCard";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { MobileBook } from "../components/MobileBook";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/SkeletonCard";
import { MobileEntityCard, MobileErrorState, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";
import { useMobileDaySchedule } from "@/mobile/hooks/useMobileDaySchedule";
import { FESTIVAL_APPEARANCE_HIGHLIGHT, formatFestivalInstant } from "@/features/festivals/appearances/bandFestivalAppearances";

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
type MobileDayQuery = ReturnType<typeof useMobileDaySchedule>;

function ScheduleWarnings({ schedule }: { schedule: MobileDayQuery }) {
  if (!schedule.warnings.length) return null;
  return <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><div className="font-semibold">Schedule may be incomplete</div><div className="mt-1 text-xs text-muted-foreground">Could not refresh: {schedule.warnings.join(", ")}.</div><button className="mt-2 text-xs font-semibold text-primary" onClick={() => schedule.refetch()}>Retry schedule</button></div></div></div>;
}

function ScheduleList({ schedule }: { schedule: MobileDayQuery }) {
  if (schedule.isLoading) return <SkeletonCard />;
  if (schedule.isError) return <MobileErrorState message="Your schedule could not be loaded." onRetry={() => schedule.refetch()} />;
  if (!schedule.data.length) return schedule.coreScheduleAvailable ? <EmptyState title="Open day" message="You have no scheduled activities for today." /> : <EmptyState title="Schedule unavailable" message="Retry before assuming the day is free." />;
  return <div className="space-y-2">{schedule.data.map((activity) => {
    const festival = activity.activity_type === "festival_performance";
    const clock = festival ? `${formatFestivalInstant(activity.scheduled_start, activity.metadata?.festival_timezone ?? null)}–${formatFestivalInstant(activity.scheduled_end, activity.metadata?.festival_timezone ?? null)}` : `${formatTime(activity.scheduled_start)}–${formatTime(activity.scheduled_end)}`;
    return <MobileEntityCard key={`${activity.activity_type}-${activity.id}`} className={festival ? `rm-mcard--festival ${FESTIVAL_APPEARANCE_HIGHLIGHT}` : undefined} title={activity.title} subtitle={`${activity.metadata?.date_only ? "Set time TBA" : clock}${activity.location ? ` • ${activity.location}` : ""}`} icon={festival ? <Sparkles className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />} meta={<MobileStatusBadge tone={activity.status === "completed" ? "success" : activity.status === "in_progress" ? "info" : "neutral"}>{activity.status.replace("_", " ")}</MobileStatusBadge>} />;
  })}</div>;
}

export default function MobileHome() {
  const { userId, profileId } = useActiveProfile();
  const [params, setParams] = useSearchParams();
  const today = useMobileDaySchedule(new Date(), userId, profileId);
  const { xpWallet, dailyXpGrant, refetch } = useGameData();
  const mode = params.get("view") === "book" ? "book" : "schedule";
  if (mode === "book") return <MobileBook profileId={profileId} onBack={() => setParams({}, { replace: true })} />;

  return <div className="space-y-4">
    <MobileSectionHeader eyebrow="Mobile Companion" title="Schedule" description="Check your day and book activities." />
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="min-h-14 justify-start gap-2" onClick={() => setParams({}, { replace: true })}><CalendarDays className="h-5 w-5" />My Schedule</Button>
      <Button className="min-h-14 justify-start gap-2" onClick={() => setParams({ view: "book" })}><CalendarPlus className="h-5 w-5" />Book Activity</Button>
    </div>
    {xpWallet ? <DailyStipendCard lastClaimDate={xpWallet.last_stipend_claim_date ?? dailyXpGrant?.created_at} streak={xpWallet.stipend_claim_streak ?? 0} lifetimeSxp={xpWallet.skill_xp_lifetime ?? xpWallet.lifetime_xp ?? 0} onClaimed={async () => { await refetch(); }} /> : null}
    <MobileSectionCard title="Today" subtitle="Scheduled activities for your active character." action={<Button size="sm" onClick={() => setParams({ view: "book" })}>Book</Button>}>
      <div className="space-y-3"><ScheduleWarnings schedule={today} /><ScheduleList schedule={today} /></div>
    </MobileSectionCard>
  </div>;
}
