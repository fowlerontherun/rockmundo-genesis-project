import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarPlus, Check, Coffee, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SOCIAL_ACTIVITY_CATALOG } from "@/features/social-activities/catalog";
import {
  categorizeSocialActivities,
  useSocialActivities,
  useSocialActivityActions,
  type SocialActivityDetailRow,
} from "@/features/social-activities/hooks";
import { useActiveProfile } from "@/hooks/useActiveProfile";

const participantNames = (row: SocialActivityDetailRow) =>
  (row.social_activity_participants ?? [])
    .map((p) => p.profiles?.display_name ?? p.profiles?.username)
    .filter(Boolean)
    .join(", ");

function ActivityRow({
  row,
  actions,
}: {
  row: SocialActivityDetailRow;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/social/activities/${row.id}`} className="text-sm font-medium hover:underline">
            {row.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(new Date(row.start_at), "EEE d MMM, HH:mm")} · {row.duration_minutes} min
          </p>
          {participantNames(row) && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">With {participantNames(row)}</p>
          )}
        </div>
        <Badge variant="outline" className="capitalize">{row.status}</Badge>
      </div>
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function Section({
  title,
  description,
  rows,
  render,
}: {
  title: string;
  description: string;
  rows: SocialActivityDetailRow[];
  render?: (row: SocialActivityDetailRow) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          rows.slice(0, 6).map((row) => <ActivityRow key={`${title}-${row.id}`} row={row} actions={render?.(row)} />)
        )}
      </CardContent>
    </Card>
  );
}

export default function SocialActivities() {
  const { profileId } = useActiveProfile();
  const { data, isLoading, isError, refetch } = useSocialActivities();
  const { respond, complete } = useSocialActivityActions();
  const rows = data ?? [];
  const groups = categorizeSocialActivities(rows, profileId);

  const suggested = SOCIAL_ACTIVITY_CATALOG.filter((a) =>
    ["coffee", "team_dinner", "tour_downtime", "conflict_resolution", "quiet_catch_up", "gig_afterparty"].includes(a.activity_type)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Social activities</h2>
          <p className="text-muted-foreground">
            Arrange hangouts, meals, celebrations and band-bonding time using the shared invitation and schedule systems.
          </p>
        </div>
        <Button asChild>
          <Link to="/social/activities/new"><CalendarPlus className="mr-2 h-4 w-4" />Create activity</Link>
        </Button>
      </div>

      {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading your social activities…</CardContent></Card>}
      {isError && (
        <Card role="alert">
          <CardContent className="flex flex-wrap items-center gap-3 p-6 text-sm text-destructive">
            Social activities could not be loaded.
            <Button size="sm" variant="outline" onClick={() => void refetch()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-3 md:grid-cols-3" aria-label="Social activity sections">
          <Section
            title="Invitations"
            description="Waiting for your response."
            rows={groups.invitations}
            render={(row) => (
              <>
                <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ activityId: row.id, response: "accepted" })}>
                  <Check className="mr-1 h-3.5 w-3.5" />Accept
                </Button>
                <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ activityId: row.id, response: "declined" })}>
                  <X className="mr-1 h-3.5 w-3.5" />Decline
                </Button>
              </>
            )}
          />
          <Section title="Upcoming" description="Confirmed plans in your diary." rows={groups.upcoming} />
          <Section
            title="Hosting"
            description="Activities you arranged."
            rows={groups.hosting}
            render={(row) => (
              <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ activityId: row.id, response: "cancelled" })}>
                Cancel
              </Button>
            )}
          />
          <Section
            title="Ready to wrap up"
            description="Finished activities awaiting their outcome."
            rows={groups.readyToComplete}
            render={(row) => (
              <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate(row.id)}>
                Complete activity
              </Button>
            )}
          />
          <Section title="Band activities" description="Plans tied to one of your bands." rows={groups.bandActivities} />
          <Section title="Recent memories" description="Completed activities and their outcomes." rows={groups.completed} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Suggested activities</CardTitle>
          <CardDescription>Prompts based on band tension, new members, tours, releases and morale.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {suggested.map((activity) => (
            <div key={activity.activity_type} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{activity.display_name}</h3>
                <Badge variant="outline">{activity.duration_options.join("/")} min</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span><Users className="mr-1 inline h-3 w-3" />{activity.minimum_participants}-{activity.maximum_participants}</span>
                <span><Coffee className="mr-1 inline h-3 w-3" />{activity.location_type.join(", ")}</span>
                <span>Mood {activity.mood_effect >= 0 ? "+" : ""}{activity.mood_effect}</span>
                <span>Stress {activity.stress_effect}</span>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to={`/social/activities/new?type=${activity.activity_type}`}>Plan this</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
