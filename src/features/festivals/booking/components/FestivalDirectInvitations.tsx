import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PublicFestivalEdition } from "../domainTypes";
import {
  useFestivalDirectInvitationActions,
  useFestivalDirectInvitations,
} from "../directInvitations";
import { formatBookingDateTime, formatBookingMoney } from "../formatting";
import { createStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";

export function FestivalDirectInvitations({
  bandId,
  editions,
}: {
  bandId?: string;
  editions: PublicFestivalEdition[];
}) {
  const invitations = useFestivalDirectInvitations(bandId);
  const { respond } = useFestivalDirectInvitationActions(bandId);
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));

  if (invitations.isLoading) return <p>Loading invitations…</p>;
  if (invitations.isError) {
    return (
      <p className="text-sm text-destructive">
        Festival invitations could not be loaded. Please retry.
      </p>
    );
  }
  if (!(invitations.data ?? []).length) return <p>No direct invitations yet.</p>;

  return (
    <div className="space-y-3">
      {(invitations.data ?? []).map((invitation) => {
        const edition = editionById.get(invitation.festivalEditionId);
        const title =
          edition?.title ?? edition?.festival_name ?? "Festival invitation";
        const actionable =
          invitation.canRespond &&
          ["sent", "viewed"].includes(invitation.status) &&
          (!invitation.expiresAt || Date.parse(invitation.expiresAt) > Date.now());

        const answer = (response: "interested" | "declined") =>
          respond.mutate(
            {
              invitationId: invitation.invitationId,
              expectedVersion: invitation.version,
              response,
              idempotencyKey: createStableMutationIdempotencyKey(
                `festival-invitation-${response}`,
                invitation.invitationId,
                invitation.version,
              ),
            },
            {
              onSuccess: () =>
                toast.success(
                  response === "interested"
                    ? "Interest sent to the festival organiser"
                    : "Invitation declined",
                ),
              onError: (error) =>
                toast.error(
                  error instanceof Error
                    ? error.message.replaceAll("_", " ")
                    : "Invitation response failed",
                ),
            },
          );

        return (
          <Card key={invitation.invitationId}>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>
                Direct invitation · {invitation.status.replaceAll("_", " ")}
                {invitation.expiresAt
                  ? ` · respond by ${formatBookingDateTime(invitation.expiresAt)}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  Suggested fee: {formatBookingMoney(invitation.suggestedFeeMinor)}
                </p>
                <p>Set length: {invitation.suggestedSetMinutes ?? "TBD"} min</p>
                <p>
                  Dates: {invitation.suggestedDates.length
                    ? invitation.suggestedDates.join(", ")
                    : "To be agreed"}
                </p>
              </div>
              {invitation.message ? (
                <p className="rounded border bg-muted/30 p-3">
                  {invitation.message}
                </p>
              ) : null}
              {actionable ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={respond.isPending}
                    onClick={() => answer("interested")}
                  >
                    I’m interested
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => answer("declined")}
                  >
                    Decline
                  </Button>
                </div>
              ) : invitation.status === "interested" ? (
                <p className="text-muted-foreground">
                  The organiser can now convert this invitation into a formal offer.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
