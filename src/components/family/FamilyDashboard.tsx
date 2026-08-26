import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Baby, Clock, Crown, Heart, History, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOptionalGameData } from "@/hooks/useGameData";
import { useMarriageStatus, usePartnerProfile, useRespondToProposal, useInitiateDivorce } from "@/hooks/useMarriage";
import {
  useChildRequests,
  usePlayerChildren,
  useRequestChild,
  useRespondToChildRequest,
  useChildRequestEvents,
  type ChildRequest,
} from "@/hooks/useChildPlanning";
import { useAuthoritativeChildBirth } from "@/hooks/useAuthoritativeChildBirth";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { MarriageStatusCard } from "./MarriageStatusCard";
import { ChildPlanningDialog } from "./ChildPlanningDialog";
import { BirthCompletionDialog } from "./BirthCompletionDialog";
import { ChildCard } from "./ChildCard";
import { ComingOfAgeDialog } from "./ComingOfAgeDialog";
import { FamilyLegacyPanel } from "@/components/social/FamilyLegacyPanel";
import { WeddingHoneymoonSection } from "./WeddingHoneymoonSection";

export function FamilyDashboard() {
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;
  const profileName = gameData?.profile?.display_name ?? gameData?.profile?.username ?? "You";
  const { data: marriage } = useMarriageStatus(profileId);
  const { data: childRequests = [] } = useChildRequests(profileId);
  const { data: children = [] } = usePlayerChildren(profileId);
  const { slots } = useCharacterSlots();

  const isPartnerA = marriage?.partner_a_id === profileId;
  const partnerId = marriage ? (isPartnerA ? marriage.partner_b_id : marriage.partner_a_id) : null;
  const { data: partnerProfile } = usePartnerProfile(partnerId ?? undefined);
  const partnerName = partnerProfile?.display_name ?? partnerProfile?.username ?? "Your Partner";
  const canonicalParentAName = isPartnerA ? profileName : partnerName;
  const canonicalParentBName = isPartnerA ? partnerName : profileName;

  const respondProposal = useRespondToProposal();
  const initiateDivorce = useInitiateDivorce();
  const requestChild = useRequestChild();
  const respondChildRequest = useRespondToChildRequest();
  const completeBirth = useAuthoritativeChildBirth();

  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [birthDialogRequest, setBirthDialogRequest] = useState<ChildRequest | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    requestId: string;
    accept: boolean;
    isAdoption: boolean;
    agency: string | null;
    feeCents: number | null;
  } | null>(null);

  const pendingChildRequests = childRequests.filter((request) => request.status === "pending");
  const acceptedChildRequests = childRequests.filter((request) => request.status === "accepted");
  const incomingChildRequests = pendingChildRequests.filter((request) => request.parent_b_id === profileId);
  const readyBirths = acceptedChildRequests.filter(
    (request) => request.gestation_ends_at && new Date(request.gestation_ends_at) <= new Date(),
  );
  const gestating = acceptedChildRequests.filter(
    (request) => !request.gestation_ends_at || new Date(request.gestation_ends_at) > new Date(),
  );
  const canPlanChild = marriage?.status === "active" && (slots?.canCreateNew ?? false);

  const deriveSurname = (request: ChildRequest) => {
    const parentASurname = canonicalParentAName.split(" ").pop() ?? canonicalParentAName;
    const parentBSurname = canonicalParentBName.split(" ").pop() ?? canonicalParentBName;
    switch (request.surname_policy) {
      case "parent_b": return parentBSurname;
      case "hyphenated": return `${parentASurname}-${parentBSurname}`;
      case "custom": return request.custom_surname ?? parentASurname;
      default: return parentASurname;
    }
  };

  const familyMembers = useMemo(() => {
    const members: any[] = [];
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
    if (partnerProfile && marriage?.status === "active") {
      members.push({
        id: partnerProfile.id,
        name: partnerName,
        relationship: "partner" as const,
        fame: partnerProfile.fame ?? 0,
        level: partnerProfile.level ?? 1,
        traits: [],
        isActive: true,
        emotionalStability: 70,
      });
    }
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
  }, [children, gameData?.profile, marriage?.status, partnerProfile, partnerName, profileName]);

  const fameInheritance = children.length > 0 ? Math.min(25, children.length * 5) : 0;
  const legacyPressure = Math.min(100, (gameData?.profile?.fame ?? 0) / 100);

  return (
    <div className="space-y-4">
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
            <p className="text-xs mt-1">Reach the Engaged relationship stage to propose marriage.</p>
          </CardContent>
        </Card>
      )}

      {marriage && ["active", "accepted", "proposed"].includes(marriage.status) && (
        <WeddingHoneymoonSection marriageId={marriage.id} />
      )}

      {readyBirths.map((request) => (
        <Card key={request.id} className="border-social-loyalty/40 bg-social-loyalty/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="h-5 w-5 text-social-loyalty" />
              <p className="text-sm font-bold text-social-loyalty">Your Child Has Arrived!</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">The wait is complete. Name your child to welcome them.</p>
            <Button size="sm" onClick={() => setBirthDialogRequest(request)} className="w-full">
              <Baby className="h-4 w-4 mr-1" /> Name Your Child 🎉
            </Button>
          </CardContent>
        </Card>
      ))}

      {children.filter((child) => (child.current_age ?? 0) >= 18 && !child.child_profile_id).map((child) => (
        <Card key={`coa-${child.id}`} className="border-social-chemistry/40 bg-social-chemistry/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-social-chemistry" />
              <p className="text-sm font-bold">{child.name} {child.surname} has come of age!</p>
            </div>
            <p className="text-xs text-muted-foreground">They can now be converted into a playable character.</p>
            <ComingOfAgeDialog child={child} autoPrompt />
          </CardContent>
        </Card>
      ))}

      {incomingChildRequests.map((request) => {
        const isAdoption = request.pathway === "adoption";
        const feeLabel = request.application_fee_cents != null ? `$${(request.application_fee_cents / 100).toLocaleString()}` : null;
        return (
          <Card key={request.id} className={isAdoption ? "border-amber-500/40 bg-amber-500/5" : "border-social-loyalty/30 bg-social-loyalty/5"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Baby className="h-4 w-4" />
                <p className="text-sm font-semibold">{isAdoption ? "Adoption Request Pending" : "Child Planning Request"}</p>
                <RequestHistoryButton requestId={request.id} />
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {partnerName} proposes a {request.upbringing_focus} upbringing focus.
                {feeLabel ? ` Application fee: ${feeLabel}.` : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={respondChildRequest.isPending} onClick={() => setConfirmAction({ requestId: request.id, accept: true, isAdoption, agency: request.agency, feeCents: request.application_fee_cents })}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" disabled={respondChildRequest.isPending} onClick={() => setConfirmAction({ requestId: request.id, accept: false, isAdoption, agency: request.agency, feeCents: request.application_fee_cents })}>
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {gestating.map((request) => (
        <Card key={request.id} className="border-social-chemistry/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-social-chemistry" />
            <div>
              <p className="text-sm font-semibold">{request.pathway === "adoption" ? "Adoption In Progress" : "Expecting a Child"}</p>
              <p className="text-xs text-muted-foreground">
                {request.gestation_ends_at ? `Arrives ${formatDistanceToNow(new Date(request.gestation_ends_at), { addSuffix: true })}` : "Process underway…"}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="h-4 w-4 text-social-loyalty" /> Children
              {children.length > 0 && <Badge variant="secondary" className="text-[10px]">{children.length}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button asChild size="sm" variant="ghost" className="text-xs h-7"><a href="/family/timeline"><Clock className="h-3.5 w-3.5 mr-1" /> Timeline</a></Button>
              {canPlanChild && (
                <Button size="sm" variant="outline" onClick={() => setChildDialogOpen(true)} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Plan Child
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <Crown className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No children yet</p>
            </div>
          ) : (
            <div className="grid gap-3">{children.map((child) => <ChildCard key={child.id} child={child} />)}</div>
          )}
        </CardContent>
      </Card>

      {familyMembers.length > 1 && (
        <FamilyLegacyPanel familyMembers={familyMembers} legacyPressure={legacyPressure} fameInheritance={fameInheritance} />
      )}

      {marriage && (
        <ChildPlanningDialog
          open={childDialogOpen}
          onOpenChange={setChildDialogOpen}
          parentAName={canonicalParentAName}
          parentBName={canonicalParentBName}
          parentAId={marriage.partner_a_id}
          parentBId={marriage.partner_b_id}
          marriageId={marriage.id}
          canCreateChild={slots?.canCreateNew ?? false}
          isPending={requestChild.isPending}
          onSubmit={(params) => requestChild.mutate({
            parentAId: marriage.partner_a_id,
            parentBId: marriage.partner_b_id,
            marriageId: marriage.id,
            ...params,
          }, { onSuccess: () => setChildDialogOpen(false) })}
        />
      )}

      {birthDialogRequest && (
        <BirthCompletionDialog
          open
          onOpenChange={(open) => { if (!open) setBirthDialogRequest(null); }}
          request={birthDialogRequest}
          surname={deriveSurname(birthDialogRequest)}
          isPending={completeBirth.isPending}
          onComplete={(name) => completeBirth.mutate({ requestId: birthDialogRequest.id, name }, { onSuccess: () => setBirthDialogRequest(null) })}
        />
      )}

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.accept ? "Accept child request?" : "Decline child request?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.accept
                ? (confirmAction.isAdoption ? "Accepting starts the adoption wait period and records your agreement." : "Accepting starts the gestation period and records your agreement.")
                : "The request will be declined and retained in the request history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!confirmAction || !profileId) return;
              respondChildRequest.mutate({ requestId: confirmAction.requestId, accept: confirmAction.accept, actorProfileId: profileId }, { onSuccess: () => setConfirmAction(null) });
            }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RequestHistoryButton({ requestId }: { requestId: string }) {
  const { data: events = [], isLoading } = useChildRequestEvents(requestId);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="View history"><History className="h-3.5 w-3.5" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="text-xs font-semibold mb-2">Request history</p>
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && events.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {events.map((event) => (
            <div key={event.id} className="text-[11px] border-l-2 border-muted pl-2">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] h-4 px-1">{event.event_type.replace(/_/g, " ")}</Badge>
                <span className="text-muted-foreground">→ {event.resulting_status}</span>
              </div>
              {event.note && <p className="text-muted-foreground italic mt-0.5">{event.note}</p>}
              <p className="text-muted-foreground/70 text-[10px] mt-0.5">{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
