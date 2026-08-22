import { Award, ChevronLeft, Clock3, DollarSign, RefreshCw } from "lucide-react";
import { useMobileDaySchedule } from "@/mobile/hooks/useMobileDaySchedule";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobilePageShell, MobileSectionCard, MobileSectionHeader, MobileStatusBadge, MobileTimeline, MobileTimelineItem } from "./MobilePrimitives";

const formatTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined;

export function MobileOutcomes({ userId, profileId, activities, loading, onRefresh, onBack }: {
  userId?: string | null;
  profileId?: string | null;
  activities: any[];
  loading?: boolean;
  onRefresh: () => void | Promise<void>;
  onBack: () => void;
}) {
  const today = useMobileDaySchedule(new Date(), userId, profileId);
  const completedToday = today.data
    .filter((activity) => activity.status === "completed")
    .slice()
    .sort((a, b) => new Date(b.scheduled_end).getTime() - new Date(a.scheduled_end).getTime());
  const recentResults = activities.slice(0, 20);

  return (
    <MobilePageShell>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back to mobile home" className="rm-tap flex h-10 w-10 items-center justify-center rounded-full border">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <MobileSectionHeader eyebrow="Companion" title="Outcomes" description="See completed activities, rewards and recent career results." />
        </div>
        <button onClick={() => void onRefresh()} aria-label="Refresh outcomes" className="rm-tap flex h-10 w-10 items-center justify-center rounded-full border">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <MobileSectionCard title="Completed today" subtitle="Authoritative completed items from your active character's schedule.">
        {today.isLoading ? <MobileLoadingSkeleton cards={2} /> : today.isError ? <MobileErrorState message="Completed activities could not be loaded." onRetry={() => today.refetch()} /> : completedToday.length === 0 ? <EmptyState title="No completed activities today" message="Practice, travel, recovery and other completed bookings will appear here." /> : (
          <div className="space-y-2">
            {completedToday.map((outcome) => (
              <MobileEntityCard
                key={`${outcome.activity_type}-${outcome.id}`}
                title={outcome.title}
                subtitle={`${formatTime(outcome.scheduled_start)}–${formatTime(outcome.scheduled_end)}${outcome.location ? ` • ${outcome.location}` : ""}`}
                icon={<Clock3 className="h-5 w-5" />}
                meta={<MobileStatusBadge tone="success">Completed</MobileStatusBadge>}
              />
            ))}
          </div>
        )}
      </MobileSectionCard>

      <MobileSectionCard title="Results & rewards" subtitle="Recent authoritative activity-feed outcomes, including earnings where recorded.">
        {loading ? <MobileLoadingSkeleton cards={3} /> : recentResults.length === 0 ? <EmptyState title="No recent outcomes" message="Rewards, milestones and completed activity results will appear here." /> : (
          <MobileTimeline>
            {recentResults.map((activity: any) => {
              const earnings = Number(activity.earnings ?? 0);
              const hasEarnings = Number.isFinite(earnings) && earnings !== 0;
              return (
                <MobileTimelineItem
                  key={activity.id}
                  title={activity.message ?? String(activity.activity_type ?? "Activity result").replace(/_/g, " ")}
                  detail={formatDateTime(activity.created_at)}
                  badge={hasEarnings ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><DollarSign className="h-3.5 w-3.5" />{earnings.toLocaleString()}</span> : <Award className="h-4 w-4 text-primary" />}
                />
              );
            })}
          </MobileTimeline>
        )}
      </MobileSectionCard>

      <Button variant="outline" className="min-h-11 w-full" onClick={() => void onRefresh()}>Refresh outcomes</Button>
    </MobilePageShell>
  );
}

export default MobileOutcomes;
