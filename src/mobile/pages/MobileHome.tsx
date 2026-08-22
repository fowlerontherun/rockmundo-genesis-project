import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Award, CalendarDays, CalendarPlus, ChevronLeft, Clock3, Gift, Heart, MessageSquare, Moon, Plane, RefreshCw, Smile, Twitter, Zap } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePracticeSkill, useSkillPracticeRestrictions } from "@/hooks/useSkillPractice";
import { useWellnessState } from "@/hooks/useWellnessState";
import { DailyStipendCard } from "@/components/attributes/DailyStipendCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "../components/StatCard";
import { QuickActionCard } from "../components/QuickActionCard";
import { NotificationCard } from "../components/NotificationCard";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/SkeletonCard";
import { MobileBook } from "../components/MobileBook";
import { MobileOutcomes } from "../components/MobileOutcomes";
import { MobileEntityCard, MobileErrorState, MobileSectionCard, MobileStatusBadge } from "../components/MobilePrimitives";
import { MobileInstallPrompt, MobileNotificationGroups, MobileOfflineState, MobileReturningBriefing, MobileUpdateBanner } from "../components/MobileOnboarding";
import { resolveCompanionPath } from "@/mobile/routeRegistry";
import { useMobileDaySchedule } from "@/mobile/hooks/useMobileDaySchedule";

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const humanise = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const clamp = (value: unknown) => Math.max(0, Math.min(100, Number(value ?? 0)));
function nextWholeHour() { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; }
function toLocalInputValue(date: Date) { const pad = (n: number) => String(n).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }

type PracticeSkillOption = { slug: string; level: number };
type MobileDayQuery = ReturnType<typeof useMobileDaySchedule>;
type HomeMode = "home" | "day" | "book" | "outcomes";

function ScheduleWarnings({ schedule }: { schedule: MobileDayQuery }) {
  if (!schedule.warnings.length) return null;
  const sourceText = schedule.warnings.join(", ");
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Schedule may be incomplete</div>
          <div className="mt-1 text-xs text-muted-foreground">Could not refresh: {sourceText}. Existing schedule data is still shown where available.</div>
          <button className="mt-2 text-xs font-semibold text-primary" onClick={() => schedule.refetch()}>Retry schedule</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleList({ schedule, limit }: { schedule: MobileDayQuery; limit?: number }) {
  if (schedule.isLoading) return <SkeletonCard />;
  if (schedule.isError) return <MobileErrorState message="Your schedule could not be loaded." onRetry={() => schedule.refetch()} />;

  const rows = typeof limit === "number" ? schedule.data.slice(0, limit) : schedule.data;
  if (!rows.length) {
    return schedule.coreScheduleAvailable
      ? <EmptyState title="Open day" message="You have no scheduled activities for this day." />
      : <EmptyState title="Schedule unavailable" message="The core schedule could not be checked. Retry before assuming the day is free." />;
  }

  return (
    <div className="space-y-2">
      {rows.map((activity) => (
        <MobileEntityCard
          key={`${activity.activity_type}-${activity.id}`}
          title={activity.title}
          subtitle={`${formatTime(activity.scheduled_start)}–${formatTime(activity.scheduled_end)}${activity.location ? ` • ${activity.location}` : ""}`}
          icon={<Clock3 className="h-5 w-5" />}
          meta={<MobileStatusBadge tone={activity.status === "completed" ? "success" : activity.status === "in_progress" ? "info" : "neutral"}>{activity.status.replace("_", " ")}</MobileStatusBadge>}
        />
      ))}
    </div>
  );
}

export default function MobileHome() {
  const navigate = useNavigate();
  const { profile, skillProgress, xpWallet, dailyXpGrant, activities, loading: gameDataLoading, refetch: refetchGameData } = useGameData();
  const { userId, profileId } = useActiveProfile();
  const wellness = useWellnessState(profileId ?? null);
  const { notifications, markRead, isLoading, error: notificationsError, refetch: refetchNotifications } = useNotificationsFeed();
  const [params, setParams] = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();
  const today = useMobileDaySchedule(new Date(), userId, profileId);
  const requestedView = params.get("view");
  const mode: HomeMode = requestedView === "day" || requestedView === "book" || requestedView === "outcomes" ? requestedView : "home";
  const displayName = profile?.display_name || profile?.username || "Player";
  const filter = params.get("tab");
  const shown = filter === "notifications" ? notifications : notifications.slice(0, 5);
  const quickActions = [
    { label: "My Day", icon: <CalendarDays className="h-5 w-5" />, to: "/mobile?view=day" },
    { label: "Book", icon: <CalendarPlus className="h-5 w-5" />, to: "/mobile?view=book" },
    { label: "Outcomes", icon: <Award className="h-5 w-5" />, to: "/mobile?view=outcomes" },
    { label: "Practice", icon: <Zap className="h-5 w-5" />, to: "/mobile?view=day#practice" },
    { label: "Travel", icon: <Plane className="h-5 w-5" />, to: "/mobile/world/travel" },
    { label: "Message", icon: <MessageSquare className="h-5 w-5" />, to: "/mobile/social/messages" },
    { label: "Recover", icon: <Moon className="h-5 w-5" />, to: "/mobile/me/wellness" },
    { label: "Stipend", icon: <Gift className="h-5 w-5" />, to: "/mobile#stipend" },
    { label: "Twaater", icon: <Twitter className="h-5 w-5" />, to: "/mobile/social/twaater" },
  ];
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 5 ? "Late night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const vitals: any = wellness.vitals;
  const skillXpLifetime = Number((xpWallet as any)?.skill_xp_lifetime ?? (xpWallet as any)?.lifetime_xp ?? 0);
  const stipendStreak = Number((xpWallet as any)?.stipend_claim_streak ?? 0);
  const lastStipendClaim = (xpWallet as any)?.last_stipend_claim_date ?? (dailyXpGrant as any)?.created_at ?? null;

  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refetchGameData(),
        wellness.refresh(),
        today.refetch(),
        refetchNotifications(),
        qc.invalidateQueries(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const backHome = () => setParams({}, { replace: true });
  if (mode === "day") return <MobileDay userId={userId} profileId={profileId} skillProgress={skillProgress ?? []} onBack={backHome} />;
  if (mode === "book") return <MobileBook profileId={profileId} onBack={backHome} />;
  if (mode === "outcomes") return <MobileOutcomes userId={userId} profileId={profileId} activities={activities ?? []} loading={gameDataLoading} onRefresh={refreshAll} onBack={backHome} />;

  return <div className="space-y-4">
    <div className="flex items-center justify-between px-1"><div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{greet}</div><div className="font-bold text-xl leading-tight">{displayName}</div></div><button onClick={refreshAll} disabled={refreshing} aria-label={refreshing ? "Refreshing" : "Refresh"} className="rm-tap h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center disabled:opacity-60"><RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} /></button></div>
    <MobileOfflineState /><MobileUpdateBanner /><MobileReturningBriefing notifications={notifications} />

    {wellness.loading ? <SkeletonCard /> : wellness.error || !vitals ? <MobileSectionCard title="Vitals unavailable" subtitle="No placeholder values are shown when server wellness data cannot be loaded." action={<MobileStatusBadge tone="warning">Unavailable</MobileStatusBadge>} /> : <div className="grid grid-cols-3 gap-2">
      <StatCard label="Energy" value={clamp(vitals.energy)} icon={<Zap className="h-4 w-4" />} />
      <StatCard label="Mood" value={clamp(vitals.mood ?? vitals.happiness)} icon={<Smile className="h-4 w-4" />} />
      <StatCard label="Health" value={clamp(vitals.health ?? vitals.physical_health)} icon={<Heart className="h-4 w-4" />} />
    </div>}

    <div id="stipend">
      <DailyStipendCard lastClaimDate={lastStipendClaim} streak={stipendStreak} lifetimeSxp={skillXpLifetime} onClaimed={refetchGameData} />
    </div>

    <MobileSectionCard title="Today" subtitle="Your character-scoped schedule for today." action={<div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setParams({ view: "book" })}>Book</Button><Button size="sm" variant="outline" onClick={() => setParams({ view: "day" })}>Plan day</Button></div>}>
      <div className="space-y-3"><ScheduleWarnings schedule={today} /><ScheduleList schedule={today} limit={6} /></div>
    </MobileSectionCard>

    <section><h2 className="mb-2 px-1 font-bold text-[15px]">Quick actions</h2><div className="grid grid-cols-3 gap-2">{quickActions.map((a) => <QuickActionCard key={a.label} label={a.label} icon={a.icon} to={a.to} />)}</div></section>

    <MobileSectionCard title="Recent outcomes" subtitle="Completed activity results and rewards." action={<Button size="sm" variant="outline" onClick={() => setParams({ view: "outcomes" })}>View all</Button>}>
      {gameDataLoading ? <SkeletonCard /> : activities.length ? <div className="space-y-2">{activities.slice(0, 3).map((activity: any) => <MobileEntityCard key={activity.id} title={activity.message ?? humanise(activity.activity_type ?? "activity result")} subtitle={activity.created_at ? new Date(activity.created_at).toLocaleString() : undefined} icon={<Award className="h-5 w-5" />} meta={Number(activity.earnings ?? 0) ? <MobileStatusBadge tone="success">${Number(activity.earnings).toLocaleString()}</MobileStatusBadge> : undefined} />)}</div> : <EmptyState title="No recent outcomes" message="Completed activities and rewards will appear here." />}
    </MobileSectionCard>

    <MobileSectionCard title="Desktop gameplay" subtitle="Deep management stays on desktop by design."><p className="text-sm text-muted-foreground">Mobile handles the daily loop: booking lightweight activities, checking the day, claiming the stipend and reviewing outcomes. Song creation, detailed band management, releases, equipment, businesses and configuration-heavy systems remain desktop-only.</p></MobileSectionCard>

    <section><div className="mb-2 flex items-center justify-between px-1"><h2 className="font-bold text-[15px]">Notifications</h2><button onClick={() => navigate("/mobile/social/mail")} className="text-[12px] text-primary font-semibold">Mail</button></div><div className="space-y-2">
      {notificationsError ? <MobileErrorState message="Notifications could not be loaded." onRetry={() => refetchNotifications()} /> : <>{isLoading && <SkeletonCard />}{!isLoading && shown.length === 0 && <EmptyState title="All caught up" message="New activity will appear here." />}{filter === "notifications" ? <MobileNotificationGroups notifications={shown} onOpen={(n) => { markRead(n.id); const target = resolveCompanionPath(n.action_path); if (target) navigate(target); }} /> : shown.map((n) => <NotificationCard key={n.id} n={n} onRead={markRead} />)}</>}
    </div></section>
    <MobileInstallPrompt />
  </div>;
}

function MobileDay({ userId, profileId, skillProgress, onBack }: { userId?: string | null; profileId?: string | null; skillProgress: any[]; onBack: () => void; }) {
  const navigate = useNavigate();
  const today = useMobileDaySchedule(new Date(), userId, profileId);
  const practice = usePracticeSkill();
  const skillOptions = useMemo<PracticeSkillOption[]>(() => skillProgress
    .map((row: any) => ({ slug: String(row?.skill_slug ?? "").trim(), level: Number(row?.current_level ?? 0) }))
    .filter((row) => row.slug.length > 0 && Number.isFinite(row.level) && row.level >= 1)
    .sort((a, b) => b.level - a.level)
    .slice(0, 20), [skillProgress]);
  const [skillSlug, setSkillSlug] = useState("");
  const [when, setWhen] = useState(toLocalInputValue(nextWholeHour()));
  const practiceDate = useMemo(() => { const parsed = new Date(when); return Number.isNaN(parsed.getTime()) ? new Date() : parsed; }, [when]);
  const restrictions = useSkillPracticeRestrictions(profileId ?? undefined, practiceDate);
  useEffect(() => { if (!skillSlug && skillOptions[0]?.slug) setSkillSlug(skillOptions[0].slug); }, [skillOptions, skillSlug]);
  const selectedSkill = skillOptions.find((skill) => skill.slug === skillSlug);
  const recentOutcomes = useMemo(() => today.data
    .filter((activity) => activity.status === "completed")
    .slice()
    .sort((a, b) => new Date(b.scheduled_end).getTime() - new Date(a.scheduled_end).getTime())
    .slice(0, 5), [today.data]);
  const bookPractice = () => { if (!selectedSkill || !when) return; const scheduledStart = new Date(when); if (Number.isNaN(scheduledStart.getTime())) return; practice.mutate({ skillSlug: selectedSkill.slug, skillName: humanise(selectedSkill.slug), scheduledStart }); };

  return <div className="space-y-4">
    <div className="flex items-center gap-2"><button onClick={onBack} aria-label="Back to mobile home" className="rm-tap flex h-10 w-10 items-center justify-center rounded-full border"><ChevronLeft className="h-5 w-5" /></button><div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Companion</div><h1 className="text-xl font-bold">My Day</h1></div></div>
    <MobileSectionCard title="Today's schedule" subtitle="Gigs, rehearsals, recordings, work, travel and quick activities are merged for the active character." action={<Button size="sm" variant="outline" onClick={() => navigate("/mobile?view=book")}>Book</Button>}>
      <div className="space-y-3"><ScheduleWarnings schedule={today} /><ScheduleList schedule={today} /></div>
    </MobileSectionCard>

    <div id="practice" /><MobileSectionCard title="Quick practice" subtitle="Book a one-hour practice. The server remains authoritative for conflicts, wellness and the five-session UTC daily cap." action={<MobileStatusBadge tone={restrictions.data?.canPractice === false ? "warning" : "success"}>{restrictions.data?.sessionsRemaining ?? "—"} left</MobileStatusBadge>}>
      {restrictions.isLoading ? <SkeletonCard /> : restrictions.isError ? <MobileErrorState message="Practice availability could not be checked." onRetry={() => restrictions.refetch()} /> : skillOptions.length === 0 ? <EmptyState title="No practice skills available" message="Unlock a canonical skill on desktop before scheduling mobile practice." /> : <div className="space-y-3">{restrictions.data?.canPractice === false && <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{restrictions.data.reason}</p>}<label className="block text-sm font-medium">Skill<select value={skillSlug} onChange={(e) => setSkillSlug(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3">{skillOptions.map((skill) => <option key={skill.slug} value={skill.slug}>{humanise(skill.slug)} · level {skill.level}</option>)}</select></label><label className="block text-sm font-medium">Start time<Input type="datetime-local" value={when} min={toLocalInputValue(new Date())} onChange={(e) => setWhen(e.target.value)} className="mt-1 min-h-11" /></label><Button className="w-full min-h-11" disabled={!selectedSkill || !when || restrictions.data?.canPractice === false || practice.isPending} onClick={bookPractice}>{practice.isPending ? "Booking…" : `Schedule ${selectedSkill ? humanise(selectedSkill.slug) : "practice"}`}</Button><p className="text-xs text-muted-foreground">Only skills genuinely unlocked for this character are offered. A successful booking refreshes My Day immediately.</p></div>}
    </MobileSectionCard>

    <MobileSectionCard title="Quick tasks" subtitle="Tasks suitable for short mobile sessions."><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => navigate("/mobile?view=book")}>Book activity</Button><Button variant="outline" onClick={() => navigate("/mobile/me/wellness")}>Recover now</Button><Button variant="outline" onClick={() => navigate("/mobile/world/travel")}>Check travel</Button><Button variant="outline" onClick={() => navigate("/mobile/social/messages")}>Messages</Button></div></MobileSectionCard>
    <MobileSectionCard title="Today's outcomes" subtitle="Completed schedule items for the active character." action={<Button size="sm" variant="outline" onClick={() => navigate("/mobile?view=outcomes")}>All outcomes</Button>}>{recentOutcomes.length ? <div className="space-y-2">{recentOutcomes.map((outcome) => <MobileEntityCard key={`outcome-${outcome.activity_type}-${outcome.id}`} title={outcome.title} subtitle={`${formatTime(outcome.scheduled_start)}–${formatTime(outcome.scheduled_end)}${outcome.location ? ` • ${outcome.location}` : ""}`} icon={<Zap className="h-5 w-5" />} meta={<MobileStatusBadge tone="success">Completed</MobileStatusBadge>} />)}</div> : <EmptyState title="No completed activities today" message="Completed practice, work, travel and other schedule outcomes will appear here." />}</MobileSectionCard>
    <MobileSectionCard title="Desktop-only planning" subtitle="Complex configuration still belongs on desktop."><p className="text-sm text-muted-foreground">Mobile supports lightweight daily bookings. Recording setup, detailed rehearsals, gig configuration, songwriting setup, release planning and other multi-step management flows remain desktop-only.</p></MobileSectionCard>
  </div>;
}
