import { useNavigate } from "react-router-dom";
import { Award, CalendarDays, Guitar, Mic2, Music, PenLine, Sparkles, Users, Zap } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { QuickActionCard } from "../components/QuickActionCard";
import { EmptyState } from "../components/EmptyState";
import { MobileEntityCard, MobilePageShell, MobileProgressCard, MobileSectionCard, MobileSectionHeader, MobileStatusBadge, MobileTimeline, MobileTimelineItem } from "../components/MobilePrimitives";

export default function MobileCareer() {
  const navigate = useNavigate();
  const { profile, skills, skillProgress, xpWallet, xpLedger, activities, activityStatus, loading, error, refetch } = useGameData();
  const recent = activities.slice(0, 3);
  const topSkills = Object.entries(skills ?? {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3);
  const weeklyXp = Math.min(100, Math.round(((xpWallet as any)?.weekly_xp ?? (xpWallet as any)?.current_week_xp ?? 0) / 10));
  const activeWriting = skillProgress.find((s: any) => String(s.skill_slug).includes("songwriting") && Number(s.current_xp ?? 0) > 0);
  const currentActivity = activityStatus ? String((activityStatus as any).activity_type ?? (activityStatus as any).status ?? "Activity").replace(/_/g, " ") : null;

  const actions = [
    ["Practice", <Zap className="h-5 w-5" />, "/stage-practice"], ["Write Song", <PenLine className="h-5 w-5" />, "/songwriting"],
    [activeWriting ? "Continue Writing" : "View Songs", <Music className="h-5 w-5" />, activeWriting ? "/songwriting" : "/song-manager"], ["Book Rehearsal", <Users className="h-5 w-5" />, "/rehearsals"],
    ["Setlist", <Guitar className="h-5 w-5" />, "/setlists"], ["Book Studio", <Mic2 className="h-5 w-5" />, "/recording-studio"],
    ["Skills", <Sparkles className="h-5 w-5" />, "/skills"], ["Band", <Users className="h-5 w-5" />, "/band"],
  ] as const;

  return <MobilePageShell>
    <MobileSectionHeader eyebrow="Career" title="Band command" description="Practice, write, rehearse and record without leaving the mobile shell." />
    {error && <MobileSectionCard title="Partial data issue" subtitle={error} action={<button onClick={refetch} className="text-xs font-semibold text-primary">Retry</button>} />}
    <MobileSectionCard title="Current band" subtitle={profile?.stage_name || profile?.display_name || "Solo artist"} action={<MobileStatusBadge tone={currentActivity ? "info" : "neutral"}>{currentActivity ?? "Available"}</MobileStatusBadge>}>
      <div className="grid grid-cols-2 gap-2">
        <MobileProgressCard label="Weekly XP" value={weeklyXp} detail="Progress from existing XP wallet" />
        <MobileProgressCard label="Readiness" value={topSkills[0] ? Math.min(100, Number(topSkills[0][1]) * 10) : 0} detail={topSkills[0] ? `${topSkills[0][0]} level ${topSkills[0][1]}` : "Build skills to improve"} />
      </div>
    </MobileSectionCard>
    <section><h2 className="mb-2 px-1 text-[15px] font-bold">Quick actions</h2><div className="grid grid-cols-4 gap-2">{actions.map(([label, icon, to]) => <QuickActionCard key={label} label={label} icon={icon} to={to} />)}</div></section>
    <MobileSectionCard title="Career snapshot" subtitle="Live summaries from your profile, XP and activity feed.">
      <div className="space-y-2">
        <MobileEntityCard title="Latest songwriting" subtitle={activeWriting ? `${activeWriting.skill_slug}: ${activeWriting.current_xp ?? 0} XP` : "No active songwriting progress found"} icon={<PenLine className="h-5 w-5" />} onPress={() => navigate("/songwriting")} />
        <MobileEntityCard title="Practice activity" subtitle={currentActivity?.includes("practice") ? currentActivity : "No practice in progress"} icon={<Zap className="h-5 w-5" />} onPress={() => navigate("/stage-practice")} />
        <MobileEntityCard title="Upcoming gig / rehearsal / recording" subtitle="Open schedule for booked sessions" icon={<CalendarDays className="h-5 w-5" />} onPress={() => navigate("/schedule/upcoming")} />
      </div>
    </MobileSectionCard>
    <MobileSectionCard title="Skills progression">{topSkills.length ? <div className="space-y-2">{topSkills.map(([k, v]) => <MobileProgressCard key={k} label={k} value={Math.min(100, Number(v) * 10)} detail={`Level ${v}`} />)}</div> : <EmptyState title="No skills yet" message="Practice to start building your career." />}</MobileSectionCard>
    <MobileSectionCard title="Recent achievements" subtitle="Recent career activity">{loading ? <EmptyState title="Loading career" /> : recent.length ? <MobileTimeline>{recent.map((a: any) => <MobileTimelineItem key={a.id} title={a.message ?? a.activity_type} detail={a.created_at ? new Date(a.created_at).toLocaleString() : undefined} badge={<Award className="h-4 w-4 text-primary" />} />)}</MobileTimeline> : <EmptyState title="No recent career activity" message="Your achievements and milestones will appear here." />}</MobileSectionCard>
  </MobilePageShell>;
}
