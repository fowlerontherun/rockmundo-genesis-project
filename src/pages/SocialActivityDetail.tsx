import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocialActivity, useSocialActivityActions } from "@/features/social-activities/hooks";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export default function SocialActivityDetail() {
  const { activityId } = useParams();
  const { profileId } = useActiveProfile();
  const { data: activity, isLoading, isError, refetch } = useSocialActivity(activityId);
  const { respond, complete } = useSocialActivityActions();

  if (isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading activity…</CardContent></Card>;
  }

  if (isError || !activity) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Activity unavailable</CardTitle>
          <CardDescription>Only participants and authorised users can view these details.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Try again</Button>
          <Button asChild size="sm" variant="ghost"><Link to="/social/activities">Back to activities</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const participants = activity.social_activity_participants ?? [];
  const mine = participants.find((p) => p.player_id === profileId) ?? null;
  const isHost = activity.host_player_id === profileId;
  const isOpen = !["completed", "cancelled", "expired"].includes(activity.status);
  const canRespond = mine?.invitation_status === "pending" && isOpen;
  const canComplete = isHost && isOpen && new Date(activity.end_at).getTime() <= Date.now();

  return (
    <div className="space-y-4">
      <Button asChild size="sm" variant="ghost"><Link to="/social/activities"><ArrowLeft className="mr-1 h-4 w-4" />Back to activities</Link></Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{activity.title}</CardTitle>
              <CardDescription className="capitalize">{activity.activity_type.replace(/_/g, " ")}</CardDescription>
            </div>
            <Badge variant="outline" className="capitalize">{activity.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {activity.description && <p className="text-muted-foreground">{activity.description}</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-muted-foreground">Starts: </span>{format(new Date(activity.start_at), "EEE d MMM yyyy, HH:mm")}</div>
            <div><span className="text-muted-foreground">Ends: </span>{format(new Date(activity.end_at), "EEE d MMM yyyy, HH:mm")}</div>
            <div><span className="text-muted-foreground">Duration: </span>{activity.duration_minutes} minutes</div>
            <div><span className="text-muted-foreground">Visibility: </span><span className="capitalize">{activity.visibility.replace(/_/g, " ")}</span></div>
            <div><span className="text-muted-foreground">Cost split: </span><span className="capitalize">{activity.cost_payer.replace(/_/g, " ")}</span></div>
            <div>
              <span className="text-muted-foreground">Cost: </span>
              ${Number(activity.actual_cost ?? activity.estimated_cost ?? 0).toLocaleString()}
              {activity.actual_cost == null ? " (estimated)" : ""}
            </div>
          </div>

          {(canRespond || canComplete || (isHost && isOpen)) && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {canRespond && (
                <>
                  <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ activityId: activity.id, response: "accepted" })}>
                    <Check className="mr-1 h-4 w-4" />Accept invitation
                  </Button>
                  <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ activityId: activity.id, response: "declined" })}>
                    <X className="mr-1 h-4 w-4" />Decline
                  </Button>
                </>
              )}
              {canComplete && (
                <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate(activity.id)}>
                  Complete activity
                </Button>
              )}
              {isHost && isOpen && (
                <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ activityId: activity.id, response: "cancelled" })}>
                  Cancel activity
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Participants</CardTitle>
          <CardDescription>Invitation responses and attendance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participant records are visible to you.</p>
          ) : (
            participants.map((participant) => (
              <div key={participant.player_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <span className="font-medium">
                  {participant.profiles?.display_name ?? participant.profiles?.username ?? "Player"}
                  {participant.player_id === activity.host_player_id ? " · host" : ""}
                </span>
                <span className="flex gap-2">
                  <Badge variant="secondary" className="capitalize">{participant.invitation_status}</Badge>
                  <Badge variant="outline" className="capitalize">{participant.attendance_status.replace(/_/g, " ")}</Badge>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
