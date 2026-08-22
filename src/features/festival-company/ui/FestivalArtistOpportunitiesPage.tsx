import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  useFestivalArtistOpportunities,
} from "../application/useFestivalArtistWorkflows";
import { formatMinorMoney } from "../domain/festivalTicketPlan";
import type { FestivalArtistOpportunity } from "../domain/festivalArtistWorkflows";

const id = () => crypto.randomUUID();

type WorkflowRow = Record<string, unknown>;

const value = (row: WorkflowRow, camel: string, snake: string) =>
  row[camel] ?? row[snake];

const text = (
  row: WorkflowRow,
  camel: string,
  snake: string,
  fallback = "",
) => {
  const current = value(row, camel, snake);
  return typeof current === "string" ? current : fallback;
};

const number = (
  row: WorkflowRow,
  camel: string,
  snake: string,
  fallback = 0,
) => {
  const current = Number(value(row, camel, snake));
  return Number.isFinite(current) ? current : fallback;
};

const statusLabel = (status: string) => status.replaceAll("_", " ");

const dateLabel = (raw: unknown) => {
  if (typeof raw !== "string" || !raw) return null;
  const parsed = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed);
};

const message: Record<string, string> = {
  FESTIVAL_APPLICATION_ALREADY_EXISTS:
    "This act already has an active application or invitation.",
  FESTIVAL_APPLICATION_WINDOW_CLOSED: "Applications are closed.",
  FESTIVAL_APPLICATION_DEADLINE_PASSED: "The application deadline has passed.",
  FESTIVAL_APPLICATION_ARTIST_INELIGIBLE:
    "This act does not currently meet the Festival requirements.",
  FESTIVAL_APPLICATION_INSUFFICIENT_SONGS:
    "This act needs more performance-ready songs.",
  FESTIVAL_APPLICATION_GENRE_MISMATCH:
    "This act's genre does not match this edition.",
  FESTIVAL_APPLICATION_SCHEDULE_CONFLICT:
    "This act has a scheduling conflict.",
  FESTIVAL_APPLICATION_VERSION_CONFLICT:
    "This application changed. Refresh and try again.",
  FESTIVAL_APPLICATION_ACCESS_DENIED:
    "You are not authorised to represent this act.",
  festival_artist_action_forbidden:
    "You are not authorised to take that Festival action.",
  festival_artist_invitation_invalid_transition:
    "That invitation has changed or can no longer be answered.",
  festival_artist_offer_invalid_transition:
    "That Festival offer has changed or can no longer be answered.",
  festival_artist_offer_stale:
    "That Festival offer changed. Refresh and review the latest terms.",
  festival_artist_offer_budget_exceeded:
    "The Festival no longer has enough artist budget for this offer.",
};

const friendly = (error: unknown) => {
  const raw = error instanceof Error ? error.message : "";
  const code = Object.keys(message).find((candidate) => raw.includes(candidate));
  return code
    ? message[code]
    : "The Festival could not complete that action. Please refresh and try again.";
};

export default function FestivalArtistOpportunitiesPage() {
  const query = useFestivalArtistOpportunities();
  const submit = useFestivalArtistAction("submitApplication");
  const withdraw = useFestivalArtistAction("withdrawApplication");
  const respondInvitation = useFestivalArtistAction("respondInvitation");
  const respondOffer = useFestivalArtistAction("respondOffer");
  const [search, setSearch] = useState("");
  const [artist, setArtist] = useState("");
  const [error, setError] = useState("");

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(friendly(caught));
    }
  };

  const opportunities = useMemo(
    () =>
      query.data?.openApplications.filter((opportunity) =>
        opportunity.name.toLowerCase().includes(search.toLowerCase()),
      ) ?? [],
    [query.data, search],
  );

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <p role="status">Loading Festival opportunities…</p>
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="text-2xl font-bold">Festival opportunities</h1>
        <p role="alert">Your Festival opportunity inbox is unavailable.</p>
      </main>
    );
  }

  const data = query.data;
  const identities = [
    ...(data.permissions.canApplySolo
      ? [
          {
            label: "Solo performer",
            type: "solo",
            profile: data.permissions.profileId,
            band: null,
          },
        ]
      : []),
    ...data.permissions.managedBandIds.map((bandId, index) => ({
      label: `Band ${index + 1}`,
      type: "band",
      profile: null,
      band: bandId,
    })),
  ];
  const selected =
    identities.find((identity) => (identity.band ?? identity.profile) === artist) ??
    identities[0];

  const apply = (opportunity: FestivalArtistOpportunity) =>
    selected &&
    run(() =>
      submit.mutateAsync({
        p_festival_company_id: opportunity.festivalCompanyId,
        p_application_window_id: opportunity.windowId,
        p_artist_type: selected.type,
        p_artist_profile_id: selected.profile,
        p_band_id: selected.band,
        p_preferred_dates: [],
        p_preferred_stage_types: [],
        p_minimum_fee_minor: 0,
        p_requested_fee_minor: 0,
        p_minimum_set_minutes: 30,
        p_maximum_set_minutes: 60,
        p_message: null,
        p_idempotency_key: id(),
      }),
    );

  const answerInvitation = (
    row: WorkflowRow,
    response: "interested" | "declined",
  ) =>
    run(() =>
      respondInvitation.mutateAsync({
        p_invitation_id: row.id,
        p_expected_version: number(row, "version", "version", 1),
        p_response: response,
        p_idempotency_key: id(),
      }),
    );

  const answerOffer = (row: WorkflowRow, response: "accept" | "decline") =>
    run(() =>
      respondOffer.mutateAsync({
        p_offer_id: row.id,
        p_expected_version: number(row, "offerVersion", "offer_version", 1),
        p_response: response,
        p_idempotency_key: id(),
      }),
    );

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4">
      <header>
        <h1 className="text-3xl font-bold">Festival opportunities</h1>
        <p className="text-muted-foreground">
          Apply to annual Festivals, answer invitations and accept performance
          offers without leaving the simplified Festival flow.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Search
          <Input
            aria-label="Search Festival opportunities"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Festival name"
          />
        </label>
        <label className="space-y-1 text-sm">
          Apply as
          <select
            aria-label="Apply as"
            className="flex h-10 w-full rounded-md border bg-background px-3"
            value={selected?.band ?? selected?.profile ?? ""}
            onChange={(event) => setArtist(event.target.value)}
          >
            {identities.map((identity) => (
              <option
                key={identity.band ?? identity.profile ?? identity.label}
                value={identity.band ?? identity.profile ?? ""}
              >
                {identity.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Open applications</CardTitle>
          <CardDescription>{opportunities.length} opportunity(s)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here right now.</p>
          ) : (
            opportunities.map((opportunity) => (
              <article className="rounded-lg border p-3" key={opportunity.windowId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{opportunity.name}</strong>
                  <Badge
                    variant={
                      opportunity.canApply && opportunity.eligibility?.eligible !== false
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {opportunity.eligibility?.eligible === false
                      ? "Not eligible"
                      : "Open"}
                  </Badge>
                </div>
                <p className="text-sm">
                  Deadline: {new Date(opportunity.closesAt).toLocaleString("en-GB")}
                </p>
                {opportunity.preferredGenres.length ? (
                  <p className="text-sm">
                    Genres: {opportunity.preferredGenres.join(", ")}
                  </p>
                ) : null}
                {opportunity.minimumFame !== null ? (
                  <p className="text-sm">
                    Minimum fame: {opportunity.minimumFame}
                  </p>
                ) : null}
                {opportunity.eligibility?.reasons.map((reason) => (
                  <p className="text-sm text-destructive" key={reason.code}>
                    {message[reason.code] ??
                      reason.code.replaceAll("_", " ").toLowerCase()}
                  </p>
                ))}
                <Button
                  className="mt-3"
                  disabled={
                    !selected ||
                    !opportunity.canApply ||
                    opportunity.eligibility?.eligible === false ||
                    submit.isPending
                  }
                  onClick={() => apply(opportunity)}
                >
                  Apply
                </Button>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My applications</CardTitle>
          <CardDescription>{data.applications.length} application(s)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            data.applications.map((row) => {
              const status = text(row, "status", "status", "unknown");
              return (
                <article className="rounded-lg border p-3" key={String(row.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>Festival application</strong>
                    <Badge variant="secondary" className="capitalize">
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  {["submitted", "under_review"].includes(status) ? (
                    <Button
                      className="mt-3"
                      variant="outline"
                      disabled={withdraw.isPending}
                      onClick={() =>
                        run(() =>
                          withdraw.mutateAsync({
                            p_application_id: row.id,
                            p_expected_version: number(row, "version", "version", 1),
                            p_idempotency_key: id(),
                          }),
                        )
                      }
                    >
                      Withdraw
                    </Button>
                  ) : null}
                  {status === "offer_pending" ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Festival management is preparing an offer. It will appear
                      below when it is ready for you to answer.
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>{data.invitations.length} invitation(s)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invitations right now.
            </p>
          ) : (
            data.invitations.map((row) => {
              const status = text(row, "status", "status", "unknown");
              const suggestedFee = number(
                row,
                "suggestedFeeMinor",
                "suggested_fee_minor",
              );
              const suggestedMinutes = number(
                row,
                "suggestedSetMinutes",
                "suggested_set_minutes",
              );
              return (
                <article className="rounded-lg border p-3" key={String(row.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>Festival invitation</strong>
                    <Badge className="capitalize">{statusLabel(status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Suggested fee {formatMinorMoney(suggestedFee, "GBP")}
                    {suggestedMinutes ? ` · ${suggestedMinutes} minute set` : ""}
                  </p>
                  {["sent", "viewed"].includes(status) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        disabled={respondInvitation.isPending}
                        onClick={() => answerInvitation(row, "interested")}
                      >
                        I'm interested
                      </Button>
                      <Button
                        variant="outline"
                        disabled={respondInvitation.isPending}
                        onClick={() => answerInvitation(row, "declined")}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                  {status === "interested" ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Interest sent. Festival management can now send you a formal
                      performance offer.
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance offers</CardTitle>
          <CardDescription>
            {data.offers.length} offer(s) · accept here to confirm the booking
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No performance offers right now.
            </p>
          ) : (
            data.offers.map((row) => {
              const status = text(row, "status", "status", "unknown");
              const currency = text(row, "currencyCode", "currency_code", "GBP");
              const fee = number(row, "offeredFeeMinor", "offered_fee_minor");
              const setMinutes = number(row, "setMinutes", "set_minutes");
              const billing = text(
                row,
                "billingPosition",
                "billing_position",
                "support",
              );
              const preferredDate = dateLabel(
                value(row, "preferredDate", "preferred_date"),
              );
              const deadline = dateLabel(
                value(row, "responseDeadline", "response_deadline"),
              );

              return (
                <article className="rounded-lg border p-3" key={String(row.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>Festival performance offer</strong>
                    <Badge variant="secondary" className="capitalize">
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    <strong>{formatMinorMoney(fee, currency)}</strong>
                    {setMinutes ? ` · ${setMinutes} minute set` : ""}
                    {billing ? ` · ${statusLabel(billing)}` : ""}
                  </p>
                  {preferredDate || deadline ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {preferredDate ? `Preferred date ${preferredDate}` : ""}
                      {preferredDate && deadline ? " · " : ""}
                      {deadline ? `Reply by ${deadline}` : ""}
                    </p>
                  ) : null}
                  {["sent", "countered"].includes(status) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        disabled={respondOffer.isPending}
                        onClick={() => answerOffer(row, "accept")}
                      >
                        Accept offer
                      </Button>
                      <Button
                        variant="outline"
                        disabled={respondOffer.isPending}
                        onClick={() => answerOffer(row, "decline")}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                  {status === "accepted" ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Offer accepted. Your confirmed Festival booking is shown
                      below.
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confirmed Festival bookings</CardTitle>
          <CardDescription>{data.bookings.length} booking(s)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Accepted Festival performances will appear here.
            </p>
          ) : (
            data.bookings.map((row) => {
              const status = text(row, "status", "status", "unknown");
              const currency = text(row, "currencyCode", "currency_code", "GBP");
              const fee = number(row, "agreedFeeMinor", "agreed_fee_minor");
              const setMinutes = number(row, "setMinutes", "set_minutes");
              const billing = text(
                row,
                "billingPosition",
                "billing_position",
                "support",
              );
              const provisionalDate = dateLabel(
                value(row, "provisionalDate", "provisional_date"),
              );

              return (
                <article className="rounded-lg border p-3" key={String(row.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>Festival booking</strong>
                    <Badge
                      variant={
                        ["awaiting_schedule", "confirmed", "scheduled"].includes(
                          status,
                        )
                          ? "default"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    <strong>{formatMinorMoney(fee, currency)}</strong>
                    {setMinutes ? ` · ${setMinutes} minute set` : ""}
                    {billing ? ` · ${statusLabel(billing)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {provisionalDate
                      ? `Provisional performance date ${provisionalDate}. The game will create the final running order automatically.`
                      : "The game will assign the performance to the automatic running order."}
                  </p>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      {!identities.length ? (
        <p role="note">
          A leader, founder, co-leader or manager must take Festival actions for a
          band.
        </p>
      ) : null}
      <Button asChild variant="outline">
        <Link to="/gigs">Back to gigs</Link>
      </Button>
    </main>
  );
}
