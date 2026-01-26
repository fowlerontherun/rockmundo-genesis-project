import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollaborationInvites, Collaboration } from "@/hooks/useCollaborationInvites";
import { CollaboratorInviteDialog } from "./CollaboratorInviteDialog";
import { Users, UserPlus, DollarSign, Percent, Clock, Check, X, Loader2, Trash2 } from "lucide-react";

interface ProjectCollaboratorsPanelProps {
  projectId: string;
  userBandId?: string;
  isOwner?: boolean;
}

export const ProjectCollaboratorsPanel = ({
  projectId,
  userBandId,
  isOwner = true,
}: ProjectCollaboratorsPanelProps) => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const { collaborators, loadingCollaborators, cancelInvitation } = useCollaborationInvites(projectId);

  const getStatusBadge = (collab: Collaboration) => {
    switch (collab.status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-warning border-warning">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="text-primary border-primary">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="outline" className="text-destructive border-destructive">
            <X className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  const getCompensationBadge = (collab: Collaboration) => {
    if (collab.is_band_member || collab.compensation_type === "none") {
      return (
        <Badge variant="secondary" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          Band
        </Badge>
      );
    }

    if (collab.compensation_type === "flat_fee") {
      return (
        <Badge variant="secondary" className="text-xs">
          <DollarSign className="h-3 w-3 mr-1" />
          ${collab.flat_fee_amount?.toLocaleString() ?? 0}
          {collab.fee_paid && <Check className="h-3 w-3 ml-1 text-primary" />}
        </Badge>
      );
    }

    if (collab.compensation_type === "royalty") {
      return (
        <Badge variant="secondary" className="text-xs">
          <Percent className="h-3 w-3 mr-1" />
          {collab.royalty_percentage}%
        </Badge>
      );
    }

    return null;
  };

  const handleCancelInvitation = (collaborationId: string) => {
    cancelInvitation.mutate(collaborationId);
  };

  const acceptedCollaborators = collaborators?.filter((c) => c.status === "accepted") || [];
  const pendingCollaborators = collaborators?.filter((c) => c.status === "pending") || [];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Collaborators
              {acceptedCollaborators.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {acceptedCollaborators.length}
                </Badge>
              )}
            </CardTitle>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Invite
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingCollaborators ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : collaborators && collaborators.length > 0 ? (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {/* Accepted collaborators */}
                {acceptedCollaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-accent/30"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={collab.invitee_profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {collab.invitee_profile?.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {collab.invitee_profile?.username || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {getCompensationBadge(collab)}
                      </div>
                    </div>
                    {getStatusBadge(collab)}
                  </div>
                ))}

                {/* Pending invitations */}
                {pendingCollaborators.length > 0 && (
                  <>
                    {acceptedCollaborators.length > 0 && (
                      <div className="text-xs text-muted-foreground pt-2">
                        Pending Invitations
                      </div>
                    )}
                    {pendingCollaborators.map((collab) => (
                      <div
                        key={collab.id}
                        className="flex items-center gap-3 p-2 rounded-lg border border-dashed"
                      >
                        <Avatar className="h-8 w-8 opacity-60">
                          <AvatarImage src={collab.invitee_profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {collab.invitee_profile?.username?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate opacity-80">
                            {collab.invitee_profile?.username || "Unknown"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {getCompensationBadge(collab)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(collab)}
                          {isOwner && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleCancelInvitation(collab.id)}
                              disabled={cancelInvitation.isPending}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No collaborators yet</p>
              {isOwner && (
                <p className="text-xs mt-1">
                  Invite band members or friends to co-write
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CollaboratorInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        projectId={projectId}
        userBandId={userBandId}
      />
    </>
  );
};
