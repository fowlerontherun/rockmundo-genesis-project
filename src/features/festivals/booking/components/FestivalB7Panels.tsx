import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FestivalApplicationRecord,
  FestivalContractRecord,
} from "../domainTypes";
import { formatBookingDateTime } from "../formatting";
import { useFestivalBookingSlots } from "../hooks";
import { createStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";
import {
  useFestivalBookingRealtime,
  useFestivalCollaborationActions,
  useFestivalCollaborationCandidates,
  useFestivalContractCollaborators,
  useFestivalFanVoteActions,
  useFestivalRivalries,
  useFestivalRivalryActions,
  useFestivalRivalryCandidates,
  useMyFestivalCollaborationObligations,
  useOpenFestivalFanVotes,
  useOrganiserFestivalFanVotes,
} from "../b7CollaborationVoting";

function readableObligations(value: Record<string, unknown>) {
  const notes = typeof value.notes === "string" ? value.notes : null;
  const soundcheck = value.soundcheck_required === true;
  const performance = value.performance_required !== false;
  return [
    performance ? "performance required" : null,
    soundcheck ? "soundcheck required" : null,
    notes,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function FestivalContractCollaborationPanel({
  contract,
}: {
  contract: FestivalContractRecord;
}) {
  const [search, setSearch] = useState("");
  const [profileId, setProfileId] = useState("");
  const [role, setRole] = useState<"guest" | "featured">("guest");
  const [notes, setNotes] = useState("");
  const candidates = useFestivalCollaborationCandidates(contract.id, search);
  const collaborations = useFestivalContractCollaborators(contract.id);
  const actions = useFestivalCollaborationActions(contract.id);

  if (contract.status !== "active") return null;

  const invite = () => {
    if (!profileId) return;
    actions.invite.mutate(
      {
        contractId: contract.id,
        profileId,
        role,
        obligations: {
          performance_required: true,
          soundcheck_required: true,
          notes: notes.trim() || null,
        },
        idempotencyKey: createStableMutationIdempotencyKey(
          "festival-collaborator",
          `${contract.id}:${profileId}:${role}`,
        ),
      },
      {
        onSuccess: () => {
          setProfileId("");
          setNotes("");
          toast.success("Collaboration invitation sent");
        },
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "Could not invite collaborator",
          ),
      },
    );
  };

  return (
    <div className="space-y-3 rounded border p-3">
      <div>
        <h4 className="font-medium">Guest & featured performers</h4>
        <p className="text-sm text-muted-foreground">
          Guests only become part of the canonical performance after they accept
          the displayed obligations.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player name"
        />
        <Select value={profileId || undefined} onValueChange={setProfileId}>
          <SelectTrigger>
            <SelectValue placeholder="Select performer" />
          </SelectTrigger>
          <SelectContent>
            {(candidates.data ?? []).map((candidate) => (
              <SelectItem key={candidate.profileId} value={candidate.profileId}>
                {candidate.displayName}
                {candidate.username ? ` · @${candidate.username}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={role}
          onValueChange={(value) => setRole(value as "guest" | "featured")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="guest">Guest</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={!profileId || actions.invite.isPending}
          onClick={invite}
        >
          Invite
        </Button>
      </div>
      <Input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Obligations / songs / arrival notes"
      />
      <div className="space-y-2">
        {(collaborations.data ?? []).map((collaboration) => (
          <div
            key={collaboration.collaborationId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
          >
            <div>
              <span className="font-medium">{collaboration.displayName}</span>{" "}
              <span className="text-muted-foreground">· {collaboration.role}</span>
              <p className="text-xs text-muted-foreground">
                {readableObligations(collaboration.obligations) ||
                  "Performance obligation"}
              </p>
            </div>
            <Badge variant="outline">{collaboration.status}</Badge>
          </div>
        ))}
        {!collaborations.isLoading && !(collaborations.data ?? []).length ? (
          <p className="text-sm text-muted-foreground">
            No guest or featured performers are attached to this contract.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FestivalGuestCollaborationInvitations() {
  const invitations = useMyFestivalCollaborationObligations();
  const actions = useFestivalCollaborationActions();

  if (invitations.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading guest invitations…</p>;
  }

  if (!(invitations.data ?? []).length) {
    return <p className="text-sm text-muted-foreground">No guest performance invitations.</p>;
  }

  return (
    <div className="space-y-3">
      {(invitations.data ?? []).map((invitation) => (
        <Card key={invitation.collaborationId}>
          <CardHeader>
            <CardTitle className="text-base">
              {invitation.bandName} · {invitation.role} spot
            </CardTitle>
            <CardDescription>
              These obligations are frozen when you accept them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {readableObligations(invitation.obligations) ||
                "Performance attendance required"}
            </p>
            <Badge variant="outline">{invitation.status}</Badge>
            {invitation.status === "invited" ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={actions.respond.isPending}
                  onClick={() =>
                    actions.respond.mutate(
                      {
                        collaborationId: invitation.collaborationId,
                        expectedVersion: invitation.version,
                        response: "accepted",
                        idempotencyKey: createStableMutationIdempotencyKey(
                          "festival-collaboration-accept",
                          invitation.collaborationId,
                        ),
                      },
                      {
                        onSuccess: () => toast.success("Guest obligations accepted"),
                        onError: (error) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not accept invitation",
                          ),
                      },
                    )
                  }
                >
                  Accept obligations
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actions.respond.isPending}
                  onClick={() =>
                    actions.respond.mutate(
                      {
                        collaborationId: invitation.collaborationId,
                        expectedVersion: invitation.version,
                        response: "declined",
                        idempotencyKey: createStableMutationIdempotencyKey(
                          "festival-collaboration-decline",
                          invitation.collaborationId,
                        ),
                      },
                      {
                        onSuccess: () => toast.success("Guest invitation declined"),
                      },
                    )
                  }
                >
                  Decline
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FestivalRivalryPanel({
  contract,
}: {
  contract: FestivalContractRecord;
}) {
  const [rivalContractId, setRivalContractId] = useState("");
  const candidates = useFestivalRivalryCandidates(contract.id);
  const rivalries = useFestivalRivalries(contract.id);
  const actions = useFestivalRivalryActions();

  if (contract.status !== "active") return null;

  return (
    <div className="space-y-3 rounded border p-3">
      <div>
        <h4 className="font-medium">Festival rivalry objective</h4>
        <p className="text-sm text-muted-foreground">
          Challenge another booked band to outperform their final canonical
          performance score. The rival must accept before it becomes active.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={rivalContractId || undefined}
          onValueChange={setRivalContractId}
        >
          <SelectTrigger className="min-w-56">
            <SelectValue placeholder="Choose rival band" />
          </SelectTrigger>
          <SelectContent>
            {(candidates.data ?? []).map((candidate) => (
              <SelectItem
                key={candidate.rivalContractId}
                value={candidate.rivalContractId}
              >
                {candidate.rivalBandName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={!rivalContractId || actions.create.isPending}
          onClick={() =>
            actions.create.mutate(
              {
                challengerContractId: contract.id,
                rivalContractId,
                idempotencyKey: createStableMutationIdempotencyKey(
                  "festival-rivalry",
                  `${contract.id}:${rivalContractId}`,
                ),
              },
              {
                onSuccess: () => {
                  setRivalContractId("");
                  toast.success("Rivalry challenge sent");
                },
                onError: (error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not create rivalry",
                  ),
              },
            )
          }
        >
          Challenge
        </Button>
      </div>
      {(rivalries.data ?? []).map((rivalry) => (
        <div key={rivalry.rivalryId} className="rounded border p-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {rivalry.challengerBandName} vs {rivalry.rivalBandName}
            </span>
            <Badge variant="outline">
              {rivalry.resolutionResult ?? rivalry.status}
            </Badge>
          </div>
          {rivalry.canRespond ? (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  actions.respond.mutate({
                    rivalryId: rivalry.rivalryId,
                    expectedVersion: rivalry.version,
                    response: "accepted",
                    idempotencyKey: createStableMutationIdempotencyKey(
                      "festival-rivalry-accept",
                      rivalry.rivalryId,
                    ),
                  })
                }
              >
                Accept rivalry
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  actions.respond.mutate({
                    rivalryId: rivalry.rivalryId,
                    expectedVersion: rivalry.version,
                    response: "declined",
                    idempotencyKey: createStableMutationIdempotencyKey(
                      "festival-rivalry-decline",
                      rivalry.rivalryId,
                    ),
                  })
                }
              >
                Decline
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function FestivalFanVoting() {
  useFestivalBookingRealtime("player-fan-voting");
  const windows = useOpenFestivalFanVotes();
  const actions = useFestivalFanVoteActions();

  if (windows.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading fan votes…</p>;
  }

  if (!(windows.data ?? []).length) {
    return <p className="text-sm text-muted-foreground">No fan votes are open.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(windows.data ?? []).map((window) => (
        <Card key={window.windowId}>
          <CardHeader>
            <CardTitle className="text-base">{window.title}</CardTitle>
            <CardDescription>
              Voting closes {formatBookingDateTime(window.closesAt)}. The result is
              advisory; organisers still issue the canonical booking offer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {window.candidates.map((candidate) => (
              <div
                key={candidate.candidateId}
                className="flex items-center justify-between gap-2 rounded border p-2"
              >
                <div>
                  <p className="font-medium">{candidate.bandName}</p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.voteCount} vote{candidate.voteCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={
                    window.voterCandidateId === candidate.candidateId
                      ? "secondary"
                      : "outline"
                  }
                  disabled={
                    Boolean(window.voterCandidateId) || actions.castVote.isPending
                  }
                  onClick={() =>
                    actions.castVote.mutate(
                      {
                        windowId: window.windowId,
                        candidateId: candidate.candidateId,
                        idempotencyKey: createStableMutationIdempotencyKey(
                          "festival-fan-vote",
                          window.windowId,
                        ),
                      },
                      {
                        onSuccess: () => toast.success("Fan vote recorded"),
                        onError: (error) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not record vote",
                          ),
                      },
                    )
                  }
                >
                  {window.voterCandidateId === candidate.candidateId
                    ? "Voted"
                    : "Vote"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OrganiserFestivalFanVotingPanel({
  editionId,
  applications,
}: {
  editionId?: string;
  applications: FestivalApplicationRecord[];
}) {
  const slots = useFestivalBookingSlots(editionId);
  const windows = useOrganiserFestivalFanVotes(editionId);
  const actions = useFestivalFanVoteActions();
  const [slotId, setSlotId] = useState("");
  const [title, setTitle] = useState("");
  const [closesAt, setClosesAt] = useState("");

  const availableSlots = useMemo(
    () => (slots.data ?? []).filter((slot) => slot.available),
    [slots.data],
  );
  const eligibleApplications = applications.filter((application) =>
    ["submitted", "under_review", "waitlisted", "shortlisted"].includes(
      application.status,
    ),
  );

  const createWindow = () => {
    if (!editionId || !slotId || !title.trim() || !closesAt) return;
    const closeDate = new Date(closesAt);
    if (Number.isNaN(closeDate.getTime())) return;
    actions.createWindow.mutate(
      {
        editionId,
        stageSlotId: slotId,
        title: title.trim(),
        opensAt: new Date().toISOString(),
        closesAt: closeDate.toISOString(),
        idempotencyKey: createStableMutationIdempotencyKey(
          "festival-fan-vote-window",
          `${editionId}:${slotId}`,
        ),
      },
      {
        onSuccess: () => {
          setTitle("");
          setSlotId("");
          setClosesAt("");
          toast.success("Fan vote opened");
        },
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "Could not open fan vote",
          ),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open an eligible-slot fan vote</CardTitle>
          <CardDescription>
            Only currently open, unreserved canonical slots can be offered for a
            vote. Adding a candidate re-checks the application and booking state.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Select value={slotId || undefined} onValueChange={setSlotId}>
            <SelectTrigger>
              <SelectValue placeholder="Open slot" />
            </SelectTrigger>
            <SelectContent>
              {availableSlots.map((slot) => (
                <SelectItem key={slot.slotId} value={slot.slotId}>
                  {slot.stageName ?? "Stage"} · {formatBookingDateTime(slot.startAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fan vote title"
          />
          <Input
            type="datetime-local"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
            aria-label="Fan vote closing time"
          />
          <Button
            disabled={
              !editionId ||
              !slotId ||
              !title.trim() ||
              !closesAt ||
              actions.createWindow.isPending
            }
            onClick={createWindow}
          >
            Open fan vote
          </Button>
        </CardContent>
      </Card>

      {(windows.data ?? []).map((window) => {
        const candidateApplicationIds = new Set(
          window.candidates.map((candidate) => candidate.applicationId),
        );
        return (
          <Card key={window.windowId}>
            <CardHeader>
              <CardTitle className="text-base">{window.title}</CardTitle>
              <CardDescription>
                {window.status ?? "open"} · closes{" "}
                {formatBookingDateTime(window.closesAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {window.candidates.map((candidate) => (
                  <div
                    key={candidate.candidateId}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <span>{candidate.bandName}</span>
                    <Badge variant="outline">{candidate.voteCount} votes</Badge>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {eligibleApplications
                  .filter(
                    (application) =>
                      !candidateApplicationIds.has(application.id),
                  )
                  .map((application) => (
                    <Button
                      key={application.id}
                      size="sm"
                      variant="outline"
                      disabled={actions.addCandidate.isPending}
                      onClick={() =>
                        actions.addCandidate.mutate(
                          {
                            windowId: window.windowId,
                            applicationId: application.id,
                            idempotencyKey: createStableMutationIdempotencyKey(
                              "festival-fan-vote-candidate",
                              `${window.windowId}:${application.id}`,
                            ),
                          },
                          {
                            onSuccess: () =>
                              toast.success("Eligible application added to vote"),
                            onError: (error) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Application is not eligible for this vote",
                              ),
                          },
                        )
                      }
                    >
                      Add {application.band_name ?? "application"}
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
