import { formatDistanceToNow } from "date-fns";
import { Check, Clock, DollarSign, Percent, UserPlus, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollaborationInvites, type Collaboration } from "@/hooks/useCollaborationInvites";

const compensationLabel = (invitation: Collaboration) => {
  if (invitation.compensation_type === "flat_fee") {
    return (
      <Badge variant="secondary" className="gap-1">
        <DollarSign className="h-3 w-3" />
        {(invitation.flat_fee_amount ?? 0).toLocaleString()}
      </Badge>
    );
  }

  if (invitation.compensation_type === "royalty") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Percent className="h-3 w-3" />
        {invitation.royalty_percentage ?? 0}% royalty
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <Users className="h-3 w-3" />
      Co-write
    </Badge>
  );
};

export function PendingCollaborationInvites() {
  const {
    pendingInvitations,
    loadingInvitations,
    respondToInvitation,
  } = useCollaborationInvites();

  if (loadingInvitations || !pendingInvitations?.length) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Co-writing invitations
              <Badge>{pendingInvitations.length}</Badge>
            </CardTitle>
            <CardDescription>
              Accept or decline invitations from other players before joining their songwriting project.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingInvitations.map((invitation) => {
          const inviterName = invitation.inviter_profile?.username || "Another player";
          const projectTitle = invitation.project?.title || "a songwriting project";
          const initial = inviterName.slice(0, 1).toUpperCase() || "?";

          return (
            <div
              key={invitation.id}
              className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={invitation.inviter_profile?.avatar_url || undefined} />
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {inviterName} invited you to co-write {invitation.project?.title ? `“${projectTitle}”` : projectTitle}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {compensationLabel(invitation)}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 sm:shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    respondToInvitation.mutate({
                      collaborationId: invitation.id,
                      accept: false,
                    })
                  }
                  disabled={respondToInvitation.isPending}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    respondToInvitation.mutate({
                      collaborationId: invitation.id,
                      accept: true,
                    })
                  }
                  disabled={respondToInvitation.isPending}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
