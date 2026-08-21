import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Clock3, Heart, MessageSquare, Moon, Plane, RefreshCw, Smile, Twitter, Zap } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { usePracticeSkill, useSkillPracticeRestrictions } from "@/hooks/useSkillPractice";
import { useWellnessState } from "@/hooks/useWellnessState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "../components/StatCard";
import { QuickActionCard } from "../components/QuickActionCard";
import { NotificationCard } from "../components/NotificationCard";
import { EmptyState } from "../components/EmptyState";
import { SkeletonCard } from "../components/SkeletonCard";
import { MobileEntityCard, MobileErrorState, MobileSectionCard, MobileStatusBadge } from "../components/MobilePrimitives";
import { MobileInstallPrompt, MobileNotificationGroups, MobileOfflineState, MobileReturningBriefing, MobileUpdateBanner } from "../components/MobileOnboarding";
import { resolveCompanionPath } from "@/mobile/routeRegistry";

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const humanise = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const clamp = (value: unknown) => Math.max(0, Math.min(100, Number(value ?? 0)));
function nextWholeHour() { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; }
function toLocalInputValue(date: Date) { const pad = (n: number) => String(n).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }

export default function MobileHome() {
  const navigate = useNavigate();
  const { profile, skills, activities } = useGameData();
  const { userId, profileId } = useActiveProfile();
  const wellness = useWellnessState(profileId ?? null);
  const { notifications, markRead, isLoading } = useNotificationsFeed();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const today = useScheduledActivities(new Date(), userId ?? undefined);
  const mode = params.get("view") === "day" ? "day" : "home";
  const displayName = profile?.display_name || profile?.username || "Player";
  const filter = params.get("tab");
  const shown = filter === "notifications" ? notifications : notifications.slice(0, 5);
  const quickActions = [
    { label: "My Day", icon: <CalendarDays className="h-5 w-5" />, to: "/mobile?view=day" },
    { label: "Practice", icon: <Zap className="h-5 w-5" />, to: "/mobile?view=day#practice" },
    { label: "Travel", icon: <Plane className="h-5 w-5" />, to: "/mobile/world/travel" },
    { label: "Message", icon: <MessageSquare className="h-5 w-5" />, to: "/mobile/social/messages" },
    { label: "Twaater", icon: <Twitter className="h-5 w-5" />, to: "/mobile/social/twaater" },
    { label: "Recover", icon: <Moon className="h-5 w-5" />, to: "/mobile/me/wellness" },
  ];
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 5 ? "Late night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const vitals: any = wellness.vitals;

  if (mode === "day") return <MobileDay userId={userId ?? undefined} profileId={profileId ?? undefined} skills={skills ?? {}} activities={activities ?? []} onBack={() => setParams({}, { replace: true })} />;

  return <div className="space-y-4">
    <div className="flex items-center justify-between px-1"><div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{greet}</div><div className="font-bold text-xl leading-tight">{displayName}</div></div><button onClick={() => qc.invalidateQueries()} aria-label="Refresh" className="rm-tap h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"><RefreshCw className="h-5 w-5" /></button></div>
    <MobileOfflineState /><MobileUpdateBanner /><MobileReturningBriefing notifications={notifications} />

    {wellness.loading ? <SkeletonCard /> : wellness.error || !vitals ? <MobileSectionCard title="Vitals unavailable" subtitle="No placeholder values are shown when server wellness data cannot be loaded." action={<MobileStatusBadge tone="warning">Unavailable</MobileStatusBadge>} /> : <div className="grid grid-cols-3 gap-2">
      <StatCard label="Energy" value={clamp(vitals.energy)} icon={<Zap className="h-4 w-4" />} />
      <StatCard label="Mood" value={clamp(vitals.mood ?? vitals.happiness)} icon={<Smile className="h-4 w-4" />} />
      <StatCard label="Health" value={clamp(vitals.health ?? vitals.physical_health)} icon={<Heart className="h-4 w-4" />} />
    </div>}

    <MobileSectionCard title="Today" subtitle="Your authoritative schedule and completed outcomes for today." action={<Button size="sm" variant="outline" onClick={() => setParams({ view: "day" })}>Plan day</Button>}>
      {today.isLoading ? <SkeletonCard /> : today.isError ? <MobileErrorState message="Today's schedule could not be loaded." onRetry={() => today.refetch()} /> : today.data?.length ? <div className="space-y-2">{today.data.slice(0, 6).map((activity) => <MobileEntityCard key={`${activity.activity_type}-${activity.id}`} title={activity.title} subtitle={`${formatTime(activity.scheduled_start)}–${formatTime(activity.scheduled_end)}${activity.location ? ` • ${activity.location}` : ""}`} icon={<CalendarDays className="h-5 w-5" />} meta={<MobileStatusBadge tone={activity.status === "completed" ? "success" : activity.status === "in_progress" ? "info" : "neutral"}>{activity.status.replace("_", " ")}</MobileStatusBadge>} />)}</div> : <EmptyState title="Nothing scheduled today" message="Plan a quick practice or recovery activity, then check back here for progress and outcomes." />}
    </MobileSectionCard>

    <section><h2 className="mb-2 px-1 font-bold text-[15px]">Quick actions</h2><div className="grid grid-cols-3 gap-2">{quickActions.map((a) => <QuickActionCard key={a.label} label={a.label} icon={a.icon} to={a.to} />)}</div></section>
    <MobileSectionCard title="Desktop gameplay" subtitle="Deep management stays on desktop by design."><p className="text-sm text-muted-foreground">Song creation, detailed band management, releases, equipment, business management and other configuration-heavy systems are intentionally not duplicated on mobile.</p></MobileSectionCard>

    <section><div className="mb-2 flex items-center justify-between px-1"><h2 className="font-bold text-[15px]">Notifications</h2><button onClick={() => navigate("/mobile/social/mail")} className="text-[12px] text-primary font-semibold">Mail</button></div><div className="space-y-2">
      {isLoading && <SkeletonCard />}{!isLoading && shown.length === 0 && <EmptyState title="All caught up" message="New activity will appear here." />}
      {filter === "notifications" ? <MobileNotificationGroups notifications={shown} onOpen={(n) => { markRead(n.id); const target = resolveCompanionPath(n.action_path); if (target) navigate(target); }} /> : shown.map((n) => <NotificationCard key={n.id} n={n} onRead={markRead} />)}
    </div></section>
    <MobileInstallPrompt />
  </div>;
}

function MobileDay({ userId, profileId, skills, activities, onBack }: { userId?: string; profileId?: string; skills: Record<string, number | undefined>; activities: any[]; onBack: () => void; }) {
  const navigate = useNavigate();
  const today = useScheduledActivities(new Date(), userId);
  const practice = usePracticeSkill();
  const skillOptions = useMemo(() => Object.entries(skills).filter(([, value]) => Number(value ?? 0) > 0).sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0)).slice(0, 12), [skills]);
  const [skillSlug, setSkillSlug] = useState("");
  const [when, setWhen] = useState(toLocalInputValue(nextWholeHour()));
  const practiceDate = useMemo(() => { const parsed = new Date(when); return Number.isNaN(parsed.getTime()) ? new Date() : parsed; }, [when]);
  const restrictions = useSkillPracticeRestrictions(profileId, practiceDate);
  useEffect(() => { if (!skillSlug && skillOptions[0]?.[0]) setSkillSlug(skillOptions[0][0]); }, [skillOptions, skillSlug]);
  const selectedSkill = skillOptions.find(([slug]) => slug === skillSlug);
  const recentOutcomes = activities.slice(0, 5);
  const bookPractice = () => { if (!selectedSkill || !when) return; const scheduledStart = new Date(when); if (Number.isNaN(scheduledStart.getTime())) return; practice.mutate({ skillSlug: selectedSkill[0], skillName: humanise(selectedSkill[0]), scheduledStart }); };

  return <div className="space-y-4">
    <div className="flex items-center gap-2"><button onClick={onBack} aria-label="Back to mobile home" className="rm-tap flex h-10 w-10 items-center justify-center rounded-full border"><ChevronLeft className="h-5 w-5" /></button><div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Companion</div><h1 className="text-xl font-bold">My Day</h1></div></div>
    <MobileSectionCard title="Today's schedule" subtitle="Gigs, rehearsals, recordings, work, travel and scheduled activities are merged from the canonical schedule.">
      {today.isLoading ? <SkeletonCard /> : today.isError ? <MobileErrorState message="Your day could not be loaded." onRetry={() => today.refetch()} /> : today.data?.length ? <div className="space-y-2">{today.data.map((activity) => <MobileEntityCard key={`${activity.activity_type}-${activity.id}`} title={activity.title} subtitle={`${formatTime(activity.scheduled_start)}–${formatTime(activity.scheduled_end)}${activity.location ? ` • ${activity.location}` : ""}`} icon={<Clock3 className="h-5 w-5" />} meta={<MobileStatusBadge tone={activity.status === "completed" ? "success" : activity.status === "in_progress" ? "info" : "neutral"}>{activity.status.replace("_", " ")}</MobileStatusBadge>} />)}</div> : <EmptyState title="Open day" message="You have no scheduled activities today." />}
    </MobileSectionCard>

    <div id="practice" /><MobileSectionCard title="Quick practice" subtitle="Book a lightweight practice session. Conflict, wellness and daily-cap rules are checked by the existing server RPC." action={<MobileStatusBadge tone={restrictions.data?.canPractice === false ? "warning" : "success"}>{restrictions.data?.sessionsRemaining ?? "—"} left</MobileStatusBadge>}>
      {restrictions.isLoading ? <SkeletonCard /> : restrictions.isError ? <MobileErrorState message="Practice availability could not be checked." onRetry={() => restrictions.refetch()} /> : skillOptions.length === 0 ? <EmptyState title="No practice skills available" message="Unlock a skill on desktop before scheduling mobile practice." /> : <div className="space-y-3">{restrictions.data?.canPractice === false && <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{restrictions.data.reason}</p>}<label className="block text-sm font-medium">Skill<select value={skillSlug} onChange={(e) => setSkillSlug(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3">{skillOptions.map(([slug, level]) => <option key={slug} value={slug}>{humanise(slug)} · level {level}</option>)}</select></label><label className="block text-sm font-medium">Start time<Input type="datetime-local" value={when} min={toLocalInputValue(new Date())} onChange={(e) => setWhen(e.target.value)} className="mt-1 min-h-11" /></label><Button className="w-full min-h-11" disabled={!selectedSkill || !when || restrictions.data?.canPractice === false || practice.isPending} onClick={bookPractice}>{practice.isPending ? "Booking…" : `Schedule ${selectedSkill ? humanise(selectedSkill[0]) : "practice"}`}</Button><p className="text-xs text-muted-foreground">Detailed skill progression remains desktop-only.</p></div>}
    </MobileSectionCard>

    <MobileSectionCard title="Quick tasks" subtitle="Tasks suitable for short mobile sessions."><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => navigate("/mobile/me/wellness")}>Recover now</Button><Button variant="outline" onClick={() => navigate("/mobile/world/travel")}>Check travel</Button><Button variant="outline" onClick={() => navigate("/mobile/social/messages")}>Messages</Button><Button variant="outline" onClick={() => navigate("/mobile/social/twaater")}>Twaater</Button></div></MobileSectionCard>
    <MobileSectionCard title="Recent outcomes" subtitle="Latest activity outcomes available to the current character.">{recentOutcomes.length ? <div className="space-y-2">{recentOutcomes.map((outcome: any, index: number) => <MobileEntityCard key={outcome.id ?? `${outcome.activity_type}-${index}`} title={outcome.message ?? humanise(outcome.activity_type ?? "Recent activity")} subtitle={outcome.created_at ? new Date(outcome.created_at).toLocaleString() : (outcome.status ?? "Recent")} icon={<Zap className="h-5 w-5" />} meta={<MobileStatusBadge tone={outcome.status === "completed" || outcome.status === "success" ? "success" : "neutral"}>{outcome.status ?? "Update"}</MobileStatusBadge>} />)}</div> : <EmptyState title="No recent outcomes" message="Completed quick activities and schedule outcomes will appear here when available." />}</MobileSectionCard>
    <MobileSectionCard title="Desktop-only planning" subtitle="Complex bookings still belong on desktop."><p className="text-sm text-muted-foreground">Recording sessions, detailed rehearsals, gig booking, songwriting setup, release planning and other multi-step management flows are intentionally desktop-only. Mobile shows their scheduled status and outcomes once they exist.</p></MobileSectionCard>
  </div>;
}
