import { useMemo, useState } from "react";
import { ClipboardList, Search, Send, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  useFestivalArtistAction,
  useFestivalArtistCandidates,
  useFestivalEditionArtistAction,
} from "../application/useFestivalArtistWorkflows";
import type {
  ArtistIdentity,
  FestivalArtistApplication,
  FestivalArtistInvitation,
  FestivalArtistOffer,
  FestivalArtistProgrammeResult,
} from "../domain/festivalArtistProgramme";
import type { FestivalArtistCandidate } from "../domain/festivalArtistWorkflows";
import { formatMinorMoney } from "../domain/festivalTicketPlan";

const DAY_MS = 24 * 60 * 60 * 1000;

const identityKey = (identity: ArtistIdentity) => {
  if (identity.type === "solo") return `solo:${identity.artistProfileId}`;
  if (identity.type === "band") return `band:${identity.bandId}`;
  return `npc:${identity.npcArtistId}`;
};

const fallbackIdentityLabel = (identity: ArtistIdentity) => {
  if (identity.type === "band") return "Band";
  if (identity.type === "solo") return "Solo artist";
  return "NPC artist";
};

const responseDeadline = (festivalDates: string[]) => {
  const now = Date.now();
  const festivalStart = festivalDates[0]
    ? new Date(`${festivalDates[0]}T12:00:00.000Z`).getTime()
    : now + 30 * DAY_MS;
  const preferred = Math.min(now + 14 * DAY_MS, festivalStart - DAY_MS);
  return new Date(Math.max(now + DAY_MS, preferred)).toISOString();
};

const preferredDate = (festivalDates: string[], requested: string[] = []) =>
  requested.find((date) => festivalDates.includes(date)) ?? festivalDates[0] ?? null;

const offerVersionFromAction = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const offer = (value as { offer?: unknown }).offer;
  if (!offer || typeof offer !== "object") return null;
  const record = offer as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const version = Number(record.offer_version ?? record.offerVersion ?? 1);
  return id && Number.isInteger(version) && version > 0 ? { id, version } : null;
};

const minorToMajorInput = (minor: number) => String(Math.max(0, minor) / 100);

const majorInputToMinor = (value: string, fallbackMinor: number) => {
  const major = Number(value);
  if (!Number.isFinite(major) || major < 0) return Math.max(0, fallbackMinor);
  return Math.round(major * 100);
};

export function SimplifiedFestivalLineupManager({
  festivalCompanyId,
  festivalEditionId,
  data,
}: {
  festivalCompanyId: string;
  festivalEditionId: string;
  data: FestivalArtistProgrammeResult;
}) {
  const [search, setSearch] = useState("");
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
  const candidates = useFestivalArtistCandidates({
    festivalCompanyId,
    festivalEditionId,
    query: search,
  });
  const reviewApplication = useFestivalArtistAction("reviewApplication");
  const inviteArtist = useFestivalEditionArtistAction("sendInvitation");
  const createOffer = useFestivalEditionArtistAction("createOffer");
  const sendOffer = useFestivalEditionArtistAction("sendOffer");

  const candidateNames = useMemo(
    () =>
      new Map(
        (candidates.data?.items ?? []).map((candidate) => [
          identityKey(candidate.identity),
          candidate.displayName,
        ]),
      ),
    [candidates.data?.items],
  );

  const nameFor = (identity: ArtistIdentity) =>
    candidateNames.get(identityKey(identity)) ?? fallbackIdentityLabel(identity);

  const workflowError =
    reviewApplication.error ??
    inviteArtist.error ??
    createOffer.error ??
    sendOffer.error;
  const workflowPending =
    reviewApplication.isPending ||
    inviteArtist.isPending ||
    createOffer.isPending ||
    sendOffer.isPending;

  const review = (
    application: FestivalArtistApplication,
    decision: "mark_under_review" | "shortlist" | "reject",
  ) => {
    reviewApplication.mutate({
      p_festival_company_id: festivalCompanyId,
      p_application_id: application.id,
      p_expected_version: application.version,
      p_decision: decision,
      p_internal_notes: null,
      p_idempotency_key: crypto.randomUUID(),
    });
  };

  const createAndSendOffer = async (input: {
    identity: ArtistIdentity;
    applicationId?: string;
    invitationId?: string;
    feeMinor: number;
    setMinutes: number;
    requestedDates?: string[];
  }) => {
    const created = await createOffer.mutateAsync({
      festivalCompanyId,
      festivalEditionId,
      identity: input.identity,
      applicationId: input.applicationId ?? null,
      invitationId: input.invitationId ?? null,
      feeMinor: Math.max(0, input.feeMinor),
      setMinutes: Math.max(10, Math.min(240, input.setMinutes)),
      preferredDate: preferredDate(data.festivalDates, input.requestedDates),
      billingPosition: "support",
      responseDeadline: responseDeadline(data.festivalDates),
      message: "Festival performance offer",
      idempotencyKey: crypto.randomUUID(),
    });
    const createdOffer = offerVersionFromAction(created);
    if (!createdOffer) throw new Error("festival_artist_offer_invalid");
    await sendOffer.mutateAsync({
      festivalCompanyId,
      festivalEditionId,
      offerId: createdOffer.id,
      expectedVersion: createdOffer.version,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const suggestedCandidateFee = (candidate: FestivalArtistCandidate) =>
    Math.max(
      0,
      Math.round(
        (candidate.estimatedFeeMinimumMinor + candidate.estimatedFeeMaximumMinor) /
          2,
      ),
    );

  const candidateFeeInput = (candidate: FestivalArtistCandidate) => {
    const key = identityKey(candidate.identity);
    return feeInputs[key] ?? minorToMajorInput(suggestedCandidateFee(candidate));
  };

  const invite = (candidate: FestivalArtistCandidate) => {
    const key = identityKey(candidate.identity);
    const suggestedFeeMinor = suggestedCandidateFee(candidate);
    const chosenFeeMinor = majorInputToMinor(
      feeInputs[key] ?? minorToMajorInput(suggestedFeeMinor),
      suggestedFeeMinor,
    );
    inviteArtist.mutate({
      festivalCompanyId,
      festivalEditionId,
      identity: candidate.identity,
      suggestedFeeMinor: chosenFeeMinor,
      suggestedSetMinutes: 60,
      suggestedDates: data.festivalDates[0] ? [data.festivalDates[0]] : [],
      responseDeadline: responseDeadline(data.festivalDates),
      message: "We would like to invite you to perform at this year's Festival.",
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const offerApplication = (application: FestivalArtistApplication) =>
    createAndSendOffer({
      identity: application.identity,
      applicationId: application.id,
      feeMinor:
        application.requestedFeeMinor ?? application.minimumFeeMinor ?? 0,
      setMinutes: Math.max(
        application.minimumSetMinutes,
        Math.min(application.maximumSetMinutes, 60),
      ),
      requestedDates: application.preferredDates,
    });

  const offerInvitation = (invitation: FestivalArtistInvitation) => {
    const key = `invitation:${invitation.id}`;
    const suggestedFeeMinor = invitation.suggestedFeeMinor ?? 0;
    return createAndSendOffer({
      identity: invitation.identity,
      invitationId: invitation.id,
      feeMinor: majorInputToMinor(
        feeInputs[key] ?? minorToMajorInput(suggestedFeeMinor),
        suggestedFeeMinor,
      ),
      setMinutes: invitation.suggestedSetMinutes ?? 60,
      requestedDates: invitation.suggestedDates,
    });
  };

  const resendOffer = (offer: FestivalArtistOffer) =>
    sendOffer.mutate({
      festivalCompanyId,
      festivalEditionId,
      offerId: offer.id,
      expectedVersion: offer.offerVersion,
      idempotencyKey: crypto.randomUUID(),
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Applications
          </CardTitle>
          <CardDescription>
            Review bands and solo artists that applied. Shortlist the ones you
            like or send a simple performance offer straight away.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No applications have been received for this annual Festival yet.
            </p>
          ) : (
            data.applications.map((application) => (
              <div
                key={application.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{nameFor(application.identity)}</strong>
                    <Badge variant="outline" className="capitalize">
                      {application.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fame {application.fameSnapshot} · requested{" "}
                    {formatMinorMoney(
                      application.requestedFeeMinor ??
                        application.minimumFeeMinor ??
                        0,
                      data.programme?.currencyCode ?? "GBP",
                    )}
                    {application.genreSnapshot.length
                      ? ` · ${application.genreSnapshot.join(", ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {application.status === "submitted" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={workflowPending}
                      onClick={() => review(application, "mark_under_review")}
                    >
                      Review
                    </Button>
                  ) : null}
                  {application.status === "submitted" ||
                  application.status === "under_review" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={workflowPending}
                      onClick={() => review(application, "shortlist")}
                    >
                      Shortlist
                    </Button>
                  ) : null}
                  {[
                    "submitted",
                    "under_review",
                    "shortlisted",
                    "offer_pending",
                  ].includes(application.status) ? (
                    <Button
                      size="sm"
                      disabled={workflowPending}
                      onClick={() => void offerApplication(application)}
                    >
                      Send offer
                    </Button>
                  ) : null}
                  {["submitted", "under_review", "shortlisted"].includes(
                    application.status,
                  ) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={workflowPending}
                      onClick={() => review(application, "reject")}
                    >
                      Reject
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Invite an act
          </CardTitle>
          <CardDescription>
            Search player bands or solo artists, choose the fee you want to
            offer, then send the invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bands or artists"
              className="pl-9"
            />
          </div>
          {candidates.isLoading ? (
            <p className="text-sm text-muted-foreground">Finding acts…</p>
          ) : candidates.isError ? (
            <p className="text-sm text-destructive">
              Artist search is temporarily unavailable.
            </p>
          ) : (
            <div className="space-y-2">
              {(candidates.data?.items ?? []).slice(0, 12).map((candidate) => {
                const key = identityKey(candidate.identity);
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="truncate">{candidate.displayName}</strong>
                        <Badge variant="secondary" className="capitalize">
                          {candidate.identity.type}
                        </Badge>
                        {candidate.relationshipState !== "none" ? (
                          <Badge variant="outline" className="capitalize">
                            {candidate.relationshipState}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Fame {candidate.fame}
                        {candidate.genres.length
                          ? ` · ${candidate.genres.join(", ")}`
                          : ""}
                        {" · suggested "}
                        {formatMinorMoney(
                          suggestedCandidateFee(candidate),
                          data.programme?.currencyCode ?? "GBP",
                        )}
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-1 sm:w-44">
                      <label
                        htmlFor={`festival-fee-${key}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Offer amount ({data.programme?.currencyCode ?? "GBP"})
                      </label>
                      <Input
                        id={`festival-fee-${key}`}
                        type="number"
                        min={0}
                        step="1"
                        inputMode="decimal"
                        value={candidateFeeInput(candidate)}
                        disabled={candidate.relationshipState !== "none"}
                        onChange={(event) =>
                          setFeeInputs((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        workflowPending || candidate.relationshipState !== "none"
                      }
                      onClick={() => invite(candidate)}
                    >
                      Invite
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invitations and offers</CardTitle>
            <CardDescription>
              Track replies without opening a separate contracts workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.invitations.length === 0 && data.offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invitations or offers yet.
              </p>
            ) : null}
            {data.invitations.map((invitation) => {
              const key = `invitation:${invitation.id}`;
              const suggestedFeeMinor = invitation.suggestedFeeMinor ?? 0;
              return (
                <div key={invitation.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{nameFor(invitation.identity)}</strong>
                    <Badge variant="outline" className="capitalize">
                      Invite: {invitation.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Invited at{" "}
                    {formatMinorMoney(
                      suggestedFeeMinor,
                      data.programme?.currencyCode ?? "GBP",
                    )}
                  </p>
                  {invitation.status === "interested" ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-1">
                        <label
                          htmlFor={`festival-offer-${invitation.id}`}
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Final offer amount ({data.programme?.currencyCode ?? "GBP"})
                        </label>
                        <Input
                          id={`festival-offer-${invitation.id}`}
                          type="number"
                          min={0}
                          step="1"
                          inputMode="decimal"
                          value={
                            feeInputs[key] ?? minorToMajorInput(suggestedFeeMinor)
                          }
                          onChange={(event) =>
                            setFeeInputs((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={workflowPending}
                        onClick={() => void offerInvitation(invitation)}
                      >
                        Send offer
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {data.offers.map((offer) => (
              <div key={offer.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{nameFor(offer.identity)}</strong>
                  <Badge variant="outline" className="capitalize">
                    Offer: {offer.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMinorMoney(offer.offeredFeeMinor, offer.currencyCode)} ·{" "}
                  {offer.setMinutes} minute set
                </p>
                {offer.status === "draft" || offer.status === "countered" ? (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    disabled={workflowPending}
                    onClick={() => resendOffer(offer)}
                  >
                    <Send className="mr-2 h-4 w-4" /> Send offer
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confirmed acts</CardTitle>
            <CardDescription>
              Accepted offers become Festival bookings. Stage placement is
              generated automatically later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No acts are confirmed yet.
              </p>
            ) : (
              data.bookings.map((booking) => (
                <div key={booking.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{nameFor(booking.identity)}</strong>
                    <Badge variant="secondary" className="capitalize">
                      {booking.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMinorMoney(
                      booking.totalCommitmentMinor,
                      booking.currencyCode,
                    )}{" "}
                    committed · {booking.setMinutes} minute set
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {workflowError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            The line-up action could not be completed. {workflowError.message}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
