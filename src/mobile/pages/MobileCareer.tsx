import { Link, useNavigate } from "react-router-dom";
import { Award, CalendarDays, Disc3, Guitar, Mic2, Monitor, Music2, Radio, Zap } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { EmptyState } from "../components/EmptyState";
import { MobileEntityCard, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge, MobileTimeline, MobileTimelineItem } from "../components/MobilePrimitives";

const careerAreas = [
  { title: "Gigs", subtitle: "Check booked gigs in My Day; booking and setup stay on desktop.", to: "/mobile/career/gigs", icon: Guitar, schedule: true },
  { title: "Rehearsals", subtitle: "Check rehearsal commitments; detailed setup stays on desktop.", to: "/mobile/career/rehearsals", icon: Music2, schedule: true },
  { title: "Recording", subtitle: "Check studio bookings; recording setup stays on desktop.", to: "/mobile/career/recording", icon: Mic2, schedule: true },
  { title: "Band", subtitle: "Full band management remains desktop-only.", to: "/mobile/career/band", icon: Guitar, schedule: false },
  { title: "Songs", subtitle: "Song library and songwriting management remain desktop-only.", to: "/mobile/career/songs", icon: Disc3, schedule: false },
  { title: "Releases & streaming", subtitle: "Release planning and streaming management remain desktop-only.", to: "/mobile/career/releases", icon: Radio, schedule: false },
] as const;

export default function MobileCareer() {
  const navigate = useNavigate();
  const { profile, activities, loading, error, refetch } = useGameData();
  const recent = activities.slice(0, 5);

  return (
    <MobilePageShell>
      <MobileSectionHeader
        eyebrow="Career"
        title="Career companion"
        description="Plan and check your career from mobile. Detailed creation, booking and management stay on desktop."
      />

      {error && (
        <MobileSectionCard
          title="Partial data issue"
          subtitle={error}
          action={<button onClick={refetch} className="text-xs font-semibold text-primary">Retry</button>}
        />
      )}

      <MobileSectionCard
        title="Today"
        subtitle={profile?.display_name || profile?.username || "Your career"}
        action={<MobileStatusBadge tone="info">Companion</MobileStatusBadge>}
      >
        <div className="space-y-2">
          <MobileEntityCard
            title="My Day"
            subtitle="See gigs, rehearsals, recording sessions, work, travel and scheduled activities."
            icon={<CalendarDays className="h-5 w-5" />}
            onPress={() => navigate("/mobile?view=day")}
          />
          <MobileEntityCard
            title="Quick Practice"
            subtitle="Schedule a lightweight practice session using the existing practice rules."
            icon={<Zap className="h-5 w-5" />}
            onPress={() => navigate("/mobile?view=day#practice")}
          />
        </div>
      </MobileSectionCard>

      <MobileSectionCard title="Career areas" subtitle="Every option stays inside the companion experience.">
        <div className="space-y-2">
          {careerAreas.map(({ title, subtitle, to, icon: Icon, schedule }) => (
            <MobileEntityCard
              key={to}
              title={title}
              subtitle={subtitle}
              icon={<Icon className="h-5 w-5" />}
              meta={<MobileStatusBadge tone={schedule ? "info" : "neutral"}>{schedule ? "My Day" : "Desktop"}</MobileStatusBadge>}
              onPress={() => navigate(to)}
            />
          ))}
        </div>
      </MobileSectionCard>

      <MobileSectionCard title="Recent outcomes" subtitle="Career activity and completed events.">
        {loading ? (
          <EmptyState title="Loading career activity" />
        ) : recent.length ? (
          <MobileTimeline>
            {recent.map((a: any) => (
              <MobileTimelineItem
                key={a.id}
                title={a.message ?? String(a.activity_type ?? "Career update").replace(/_/g, " ")}
                detail={a.created_at ? new Date(a.created_at).toLocaleString() : undefined}
                badge={<Award className="h-4 w-4 text-primary" />}
              />
            ))}
          </MobileTimeline>
        ) : (
          <EmptyState title="No recent career outcomes" message="Completed activities and milestones will appear here." />
        )}
      </MobileSectionCard>

      <MobileSectionCard title="Desktop career management" subtitle="Full gameplay remains on desktop by design.">
        <div className="flex items-center gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
          <Monitor className="h-4 w-4 shrink-0" />
          <span>Use desktop when you want to create songs, configure bookings, manage releases, edit setlists or make other detailed career changes.</span>
        </div>
      </MobileSectionCard>

      <Link to="/mobile?view=day" className="rm-tap block rounded-xl bg-primary p-3 text-center text-sm font-semibold text-primary-foreground">
        Open My Day
      </Link>
    </MobilePageShell>
  );
}
