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
  useChildRequestEvents,
} from "@/hooks/useChildPlanning";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { MarriageStatusCard } from "./MarriageStatusCard";
import { ChildPlanningDialog } from "./ChildPlanningDialog";
import { BirthCompletionDialog } from "./BirthCompletionDialog";
import { ChildCard } from "./ChildCard";
import { FamilyLegacyPanel } from "@/components/social/FamilyLegacyPanel";
import { ScoreGauge } from "@/components/social/ScoreGauge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { History } from "lucide-react";
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
  const [confirmAction, setConfirmAction] = useState<{ requestId: string; accept: boolean; isAdoption: boolean; agency: string | null; feeCents: number | null } | null>(null);

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

      {/* Coming of Age — children 18+ not yet converted to playable */}
      {children
        .filter(c => (c.current_age ?? 0) >= 18 && !c.child_profile_id)
        .map(c => (
          <Card key={`coa-${c.id}`} className="border-social-chemistry/40 bg-gradient-to-br from-social-chemistry/10 to-transparent">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-social-chemistry" />
                <p className="text-sm font-bold">{c.name} {c.surname} has come of age!</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Convert them into a playable character with inherited bonuses from their upbringing.
              </p>
              <ComingOfAgeDialog child={c} autoPrompt />
            </CardContent>
          </Card>
        ))}

      {/* Incoming Child / Adoption Requests */}
      {incomingChildRequests.map(req => {
        const isAdoption = (req as any).pathway === "adoption";
        const agency = (req as any).agency as string | null;
        const feeCents = (req as any).application_fee_cents as number | null;
        const feeLabel = feeCents != null ? `$${(feeCents / 100).toLocaleString()}` : null;
        return (
        <Card key={req.id} className={isAdoption ? "border-amber-500/40 bg-amber-500/5" : "border-social-loyalty/30 bg-social-loyalty/5"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className={`h-4 w-4 ${isAdoption ? "text-amber-500" : "text-social-loyalty"}`} />
              <p className="text-sm font-semibold">
                {isAdoption ? "Adoption Request Pending" : "Child Planning Request"}
              </p>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {isAdoption ? `Adoption${agency ? ` · ${agency}` : ""}` : "Biological"}
              </Badge>
              <RequestHistoryButton requestId={req.id} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              {partnerName} wants to {isAdoption ? "adopt" : "plan"} a child with {req.upbringing_focus} upbringing focus.
            </p>
            {isAdoption && feeLabel && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                Application fee: {feeLabel} {agency ? `(${agency})` : ""}
              </p>
            )}
            {req.expires_at && (
              <p className="text-[10px] text-muted-foreground mb-3">
                Expires {formatDistanceToNow(new Date(req.expires_at), { addSuffix: true })}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={respondChildRequest.isPending}
                onClick={() => setConfirmAction({ requestId: req.id, accept: true, isAdoption, agency, feeCents })}
                className={`flex-1 text-white ${isAdoption ? "bg-amber-500 hover:bg-amber-500/90" : "bg-social-loyalty hover:bg-social-loyalty/90"}`}
              >
                {isAdoption ? "Accept Adoption 🤝" : "Accept 👶"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={respondChildRequest.isPending}
                onClick={() => setConfirmAction({ requestId: req.id, accept: false, isAdoption, agency, feeCents })}
                className="flex-1"
              >
                {isAdoption ? "Deny" : "Decline"}
              </Button>
            </div>
          </CardContent>
        </Card>
        );
      })}

      {/* Gestating Children (not yet ready) */}
      {acceptedChildRequests.filter(r => !r.gestation_ends_at || new Date(r.gestation_ends_at) > new Date()).map(req => {
        const isAdoption = (req as any).pathway === "adoption";
        return (
        <Card key={req.id} className="border-social-chemistry/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-social-chemistry animate-pulse" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{isAdoption ? "Adoption In Progress" : "Expecting a Child!"}</p>
                <Badge variant="outline" className="text-[10px]">{isAdoption ? "Adoption" : "Biological"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {req.gestation_ends_at
                  ? `Arrives ${formatDistanceToNow(new Date(req.gestation_ends_at), { addSuffix: true })}`
                  : (isAdoption ? "Adoption process underway..." : "Gestation in progress...")}
              </p>
            </div>
          </CardContent>
        </Card>
        );
      })}

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
            <div className="flex items-center gap-1.5">
              <Button asChild size="sm" variant="ghost" className="text-xs h-7">
                <a href="/family/timeline"><Clock className="h-3.5 w-3.5 mr-1" /> Timeline</a>
              </Button>
              {canPlanChild && (
                <Button size="sm" variant="outline" onClick={() => setChildDialogOpen(true)}
                  className="text-xs border-social-loyalty/30 text-social-loyalty hover:bg-social-loyalty/10">
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

      {/* Accept / Deny Confirmation */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.accept
                ? (confirmAction.isAdoption ? "Accept adoption request?" : "Accept child request?")
                : (confirmAction?.isAdoption ? "Deny adoption request?" : "Decline child request?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.accept && confirmAction.isAdoption && (
                <>
                  Accepting starts a 14-day adoption process
                  {confirmAction.agency ? ` with ${confirmAction.agency}` : ""}
                  {confirmAction.feeCents != null
                    ? ` and commits an application fee of $${(confirmAction.feeCents / 100).toLocaleString()}.`
                    : "."}
                </>
              )}
              {confirmAction?.accept && !confirmAction.isAdoption && (
                <>Accepting starts a 7-day gestation period before your child is born.</>
              )}
              {!confirmAction?.accept && confirmAction?.isAdoption && (
                <>The adoption agency will be notified and the request will be archived in your history.</>
              )}
              {!confirmAction?.accept && confirmAction && !confirmAction.isAdoption && (
                <>Your partner will be notified that you declined this child request.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction || !profileId) return;
                respondChildRequest.mutate(
                  {
                    requestId: confirmAction.requestId,
                    accept: confirmAction.accept,
                    actorProfileId: profileId,
                  },
                  { onSuccess: () => setConfirmAction(null) }
                );
              }}
              className={confirmAction?.accept
                ? (confirmAction.isAdoption ? "bg-amber-500 hover:bg-amber-500/90" : "")
                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
            >
              {confirmAction?.accept ? "Confirm" : "Confirm deny"}
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
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="View history">
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="text-xs font-semibold mb-2">Request history</p>
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && events.length === 0 && (
          <p className="text-xs text-muted-foreground">No events yet — actions will be logged here.</p>
        )}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {events.map(ev => (
            <div key={ev.id} className="text-[11px] border-l-2 border-muted pl-2">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] h-4 px-1">{ev.event_type.replace(/_/g, " ")}</Badge>
                <span className="text-muted-foreground">→ {ev.resulting_status}</span>
              </div>
              {ev.note && <p className="text-muted-foreground italic mt-0.5">{ev.note}</p>}
              <p className="text-muted-foreground/70 text-[10px] mt-0.5">
                {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
