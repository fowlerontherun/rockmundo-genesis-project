import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Baby, Crown, Heart, Plus, Clock, Users, Activity, Star } from "lucide-react";
// useAuth removed — profileId sourced from useOptionalGameData
import { useOptionalGameData } from "@/hooks/useGameData";
import { useMarriageStatus, usePartnerProfile, useRespondToProposal, useInitiateDivorce } from "@/hooks/useMarriage";
import {
  useChildRequests, usePlayerChildren, useRequestChild,
  useRespondToChildRequest, useCompleteChildBirth, calculateInheritedPotentials,
} from "@/hooks/useChildPlanning";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { MarriageStatusCard } from "./MarriageStatusCard";
import { ChildPlanningDialog } from "./ChildPlanningDialog";
import { BirthCompletionDialog } from "./BirthCompletionDialog";
import { ChildCard } from "./ChildCard";
import { FamilyLegacyPanel } from "@/components/social/FamilyLegacyPanel";
import { ScoreGauge } from "@/components/social/ScoreGauge";
import { formatDistanceToNow } from "date-fns";

export function FamilyDashboard() {
  // profileId derived from gameData below
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;
  const profileName = gameData?.profile?.display_name ?? gameData?.profile?.username ?? "You";

  const { data: marriage, isLoading: marriageLoading } = useMarriageStatus(profileId);
  const { data: childRequests = [] } = useChildRequests(profileId);
  const { data: children = [] } = usePlayerChildren(profileId);
  const { slots } = useCharacterSlots();

  const isPartnerA = marriage?.partner_a_id === profileId;
  const partnerId = marriage ? (isPartnerA ? marriage.partner_b_id : marriage.partner_a_id) : null;
  const { data: partnerProfile } = usePartnerProfile(partnerId ?? undefined);
  const partnerName = partnerProfile?.display_name ?? partnerProfile?.username ?? "Your Partner";

  const respondProposal = useRespondToProposal();
  const initiateDivorce = useInitiateDivorce();
  const requestChild = useRequestChild();
  const respondChildRequest = useRespondToChildRequest();
  const completeChildBirth = useCompleteChildBirth();

  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [birthDialogRequest, setBirthDialogRequest] = useState<typeof childRequests[0] | null>(null);

  const pendingChildRequests = childRequests.filter(r => r.status === "pending");
  const acceptedChildRequests = childRequests.filter(r => r.status === "accepted");
  const canPlanChild = marriage?.status === "active" && (slots?.canCreateNew ?? false);

  // Requests where this player is the recipient (parent_b)
  const incomingChildRequests = pendingChildRequests.filter(r => r.parent_b_id === profileId);

  // Check for births ready (gestation ended)
  const readyBirths = acceptedChildRequests.filter(r =>
    r.gestation_ends_at && new Date(r.gestation_ends_at) <= new Date()
  );

  // Compute inherited potentials for birth dialog
  const birthPotentials = useMemo(() => {
    if (!birthDialogRequest) return {};
    const skills = gameData?.skills;
    const parentASkills: Record<string, number> = {
      vocals: skills?.vocals ?? 1, guitar: skills?.guitar ?? 1, bass: skills?.bass ?? 1,
      drums: skills?.drums ?? 1, songwriting: skills?.songwriting ?? 1,
      performance: skills?.performance ?? 1, creativity: skills?.creativity ?? 1,
      technical: skills?.technical ?? 1, composition: skills?.composition ?? 1,
    };
    // We don't have partner skills, so use a baseline
    const parentBSkills: Record<string, number> = Object.fromEntries(
      Object.keys(parentASkills).map(k => [k, 3])
    );
    return calculateInheritedPotentials(parentASkills, parentBSkills, birthDialogRequest.upbringing_focus);
  }, [birthDialogRequest, gameData?.skills]);

  // Derive surname based on policy
  const deriveSurname = (request: typeof childRequests[0]) => {
    switch (request.surname_policy) {
      case "parent_a": return profileName.split(" ").pop() ?? profileName;
      case "parent_b": return partnerName.split(" ").pop() ?? partnerName;
      case "hyphenated": return `${profileName.split(" ").pop()}-${partnerName.split(" ").pop()}`;
      case "custom": return request.custom_surname ?? profileName;
      default: return profileName;
    }
  };

  // Build family tree data for FamilyLegacyPanel
  const familyMembers = useMemo(() => {
    const members = [];

    // Self
    if (gameData?.profile) {
      members.push({
        id: gameData.profile.id,
        name: profileName,
        relationship: "self" as const,
        fame: gameData.profile.fame ?? 0,
        level: gameData.profile.level ?? 1,
        traits: [],
        isActive: true,
        emotionalStability: 70,
      });
    }

    // Partner
    if (partnerProfile && marriage?.status === "active") {
      members.push({
        id: partnerProfile.id,
        name: partnerProfile.display_name ?? partnerProfile.username ?? "Partner",
        relationship: "partner" as const,
        fame: partnerProfile.fame ?? 0,
        level: partnerProfile.level ?? 1,
        traits: [],
        isActive: true,
        emotionalStability: 70,
      });
    }

    // Children
    for (const child of children) {
      members.push({
        id: child.id,
        name: `${child.name} ${child.surname}`,
        relationship: "child" as const,
        fame: 0,
        level: 1,
        traits: child.traits ?? [],
        isActive: child.playability_state !== "npc",
        emotionalStability: child.emotional_stability,
      });
    }

    return members;
  }, [gameData?.profile, partnerProfile, marriage, children, profileName]);

  const fameInheritance = children.length > 0 ? Math.min(25, children.length * 5) : 0;
  const legacyPressure = Math.min(100, (gameData?.profile?.fame ?? 0) / 100);

  return (
    <div className="space-y-4">
      {/* Marriage Section */}
      {marriage ? (
        <MarriageStatusCard
          marriage={marriage}
          partnerName={partnerName}
          partnerAvatarUrl={partnerProfile?.avatar_url ?? null}
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

      {/* Ready Births */}
      {readyBirths.map(req => (
        <Card key={req.id} className="border-social-loyalty/40 bg-social-loyalty/5 shadow-[0_0_16px_hsl(var(--social-loyalty)/0.15)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="h-5 w-5 text-social-loyalty animate-bounce" />
              <p className="text-sm font-bold text-social-loyalty">Your Child Has Arrived!</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              The gestation period is complete. Name your child to welcome them!
            </p>
            <Button
              size="sm"
              onClick={() => setBirthDialogRequest(req)}
              className="bg-social-loyalty hover:bg-social-loyalty/90 text-white w-full"
            >
              <Baby className="h-4 w-4 mr-1" /> Name Your Child 🎉
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Incoming Child Requests */}
      {incomingChildRequests.map(req => (
        <Card key={req.id} className="border-social-loyalty/30 bg-social-loyalty/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="h-4 w-4 text-social-loyalty" />
              <p className="text-sm font-semibold">Child Planning Request</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {partnerName} wants to plan a child with {req.upbringing_focus} upbringing focus.
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

      {/* Gestating Children (not yet ready) */}
      {acceptedChildRequests.filter(r => !r.gestation_ends_at || new Date(r.gestation_ends_at) > new Date()).map(req => (
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

      {/* Family Legacy Panel — wired with real data */}
      {familyMembers.length > 1 && (
        <FamilyLegacyPanel
          familyMembers={familyMembers}
          legacyPressure={legacyPressure}
          fameInheritance={fameInheritance}
        />
      )}

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

      {/* Birth Completion Dialog */}
      {birthDialogRequest && profileId && (
        <BirthCompletionDialog
          open={!!birthDialogRequest}
          onOpenChange={(open) => { if (!open) setBirthDialogRequest(null); }}
          request={birthDialogRequest}
          surname={deriveSurname(birthDialogRequest)}
          inheritedPotentials={birthPotentials}
          isPending={completeChildBirth.isPending}
          onComplete={(name) => {
            completeChildBirth.mutate({
              requestId: birthDialogRequest.id,
              name,
              parentAId: birthDialogRequest.parent_a_id,
              parentBId: birthDialogRequest.parent_b_id,
              marriageId: birthDialogRequest.marriage_id,
              controllerUserId: profileId ?? "",
              surname: deriveSurname(birthDialogRequest),
              inheritedPotentials: birthPotentials,
            }, {
              onSuccess: () => setBirthDialogRequest(null),
            });
          }}
        />
      )}
    </div>
  );
}
