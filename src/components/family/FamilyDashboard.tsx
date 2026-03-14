import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Baby, Crown, Heart, Plus, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import { useMarriageStatus, useRespondToProposal, useInitiateDivorce } from "@/hooks/useMarriage";
import { useChildRequests, usePlayerChildren, useRequestChild, useRespondToChildRequest } from "@/hooks/useChildPlanning";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { MarriageStatusCard } from "./MarriageStatusCard";
import { ChildPlanningDialog } from "./ChildPlanningDialog";
import { ChildCard } from "./ChildCard";
import { formatDistanceToNow } from "date-fns";

export function FamilyDashboard() {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;
  const profileName = gameData?.profile?.display_name ?? gameData?.profile?.username ?? "You";

  const { data: marriage, isLoading: marriageLoading } = useMarriageStatus(profileId);
  const { data: childRequests = [] } = useChildRequests(profileId);
  const { data: children = [] } = usePlayerChildren(profileId);
  const { slots } = useCharacterSlots();

  const respondProposal = useRespondToProposal();
  const initiateDivorce = useInitiateDivorce();
  const requestChild = useRequestChild();
  const respondChildRequest = useRespondToChildRequest();

  const [childDialogOpen, setChildDialogOpen] = useState(false);

  const isPartnerA = marriage?.partner_a_id === profileId;
  const partnerId = marriage ? (isPartnerA ? marriage.partner_b_id : marriage.partner_a_id) : null;
  const partnerName = partnerId ? "Your Partner" : ""; // Would need a profile lookup for real name

  const pendingChildRequests = childRequests.filter(r => r.status === "pending");
  const acceptedChildRequests = childRequests.filter(r => r.status === "accepted");
  const canPlanChild = marriage?.status === "active" && (slots?.canCreateNew ?? false);

  // Requests where this player is the recipient (parent_b)
  const incomingChildRequests = pendingChildRequests.filter(r => r.parent_b_id === profileId);

  return (
    <div className="space-y-4">
      {/* Marriage Section */}
      {marriage ? (
        <MarriageStatusCard
          marriage={marriage}
          partnerName={partnerName}
          isPartnerA={isPartnerA}
          onDivorce={() => profileId && initiateDivorce.mutate({ marriageId: marriage.id, profileId })}
          onAcceptProposal={() => respondProposal.mutate({ marriageId: marriage.id, accept: true })}
          onDeclineProposal={() => respondProposal.mutate({ marriageId: marriage.id, accept: false })}
        />
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Heart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Not Married</p>
            <p className="text-xs mt-1">Reach the "Engaged" stage in a romance to propose marriage.</p>
          </CardContent>
        </Card>
      )}

      {/* Incoming Child Requests */}
      {incomingChildRequests.map(req => (
        <Card key={req.id} className="border-social-loyalty/30 bg-social-loyalty/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="h-4 w-4 text-social-loyalty" />
              <p className="text-sm font-semibold">Child Planning Request</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Your partner wants to plan a child with {req.upbringing_focus} upbringing focus.
              {req.expires_at && ` Expires ${formatDistanceToNow(new Date(req.expires_at), { addSuffix: true })}.`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => respondChildRequest.mutate({ requestId: req.id, accept: true })}
                className="bg-social-loyalty hover:bg-social-loyalty/90 text-white flex-1">
                Accept 👶
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondChildRequest.mutate({ requestId: req.id, accept: false })} className="flex-1">
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Gestating Children */}
      {acceptedChildRequests.map(req => (
        <Card key={req.id} className="border-social-chemistry/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-social-chemistry animate-pulse" />
            <div>
              <p className="text-sm font-semibold">Expecting a Child!</p>
              <p className="text-xs text-muted-foreground">
                {req.gestation_ends_at
                  ? `Arrives ${formatDistanceToNow(new Date(req.gestation_ends_at), { addSuffix: true })}`
                  : "Gestation in progress..."}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Children */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="h-4 w-4 text-social-loyalty" />
              Children
              {children.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{children.length}</Badge>
              )}
            </CardTitle>
            {canPlanChild && (
              <Button size="sm" variant="outline" onClick={() => setChildDialogOpen(true)}
                className="text-xs border-social-loyalty/30 text-social-loyalty hover:bg-social-loyalty/10">
                <Plus className="h-3.5 w-3.5 mr-1" /> Plan Child
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <Crown className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No children yet</p>
              {marriage?.status === "active" && (
                <p className="text-xs mt-1">Plan a child to start building your musical dynasty!</p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {children.map(child => (
                <ChildCard key={child.id} child={child} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Child Planning Dialog */}
      {marriage && profileId && (
        <ChildPlanningDialog
          open={childDialogOpen}
          onOpenChange={setChildDialogOpen}
          parentAName={profileName}
          parentBName={partnerName}
          parentAId={profileId}
          parentBId={partnerId ?? ""}
          marriageId={marriage.id}
          canCreateChild={slots?.canCreateNew ?? false}
          isPending={requestChild.isPending}
          onSubmit={(params) => {
            if (!profileId || !partnerId || !marriage) return;
            requestChild.mutate({
              parentAId: profileId,
              parentBId: partnerId,
              marriageId: marriage.id,
              ...params,
            }, {
              onSuccess: () => setChildDialogOpen(false),
            });
          }}
        />
      )}
    </div>
  );
}
