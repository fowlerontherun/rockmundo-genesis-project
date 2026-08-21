import { Link } from "react-router-dom";
import { Award, CalendarDays, Monitor, Zap } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { EmptyState } from "../components/EmptyState";
import { MobileEntityCard, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge, MobileTimeline, MobileTimelineItem } from "../components/MobilePrimitives";

export default function MobileCareer() {
  const { profile, activities, loading, error, refetch } = useGameData();
  const recent = activities.slice(0, 5);

  return (
    <MobilePageShell>
      <MobileSectionHeader
        eyebrow="Career"
        title="Career companion"
        description="Check today's commitments and recent outcomes. Detailed career management stays on desktop."
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
            href="/mobile?view=day"
          />
          <MobileEntityCard
            title="Quick Practice"
            subtitle="Schedule a lightweight practice session using the existing practice rules."
            icon={<Zap className="h-5 w-5" />}
            href="/mobile?view=day#practice"
          />
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
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Songwriting, recording setup, rehearsals, setlists, gigs, tours, releases, streaming, band management and detailed skill management are desktop-only.</p>
          <div className="flex items-center gap-2 rounded-xl border p-3">
            <Monitor className="h-4 w-4 shrink-0" />
            <span>Use the desktop site when you want to configure or manage these systems in depth.</span>
          </div>
        </div>
      </MobileSectionCard>

      <Link to="/mobile?view=day" className="rm-tap block rounded-xl bg-primary p-3 text-center text-sm font-semibold text-primary-foreground">
        Open My Day
      </Link>
    </MobilePageShell>
  );
}
