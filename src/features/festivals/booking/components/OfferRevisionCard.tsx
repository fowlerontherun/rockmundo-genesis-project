import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canAcceptRevision,
  mapBookingError,
  selectCurrentRevision,
  type BookingSide,
  type FestivalTerms,
} from "../bookingTypes";
import { useFestivalOfferActions } from "../hooks";
import type { FestivalOfferRecord } from "../domainTypes";
import { formatBookingDateTime } from "../formatting";
import { useStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";
import { CounterOfferDialog } from "./CounterOfferDialog";
import { OfferTermsSummary } from "./OfferTermsSummary";
export function OfferRevisionCard({
  offer,
  side = "band",
}: {
  offer: FestivalOfferRecord;
  side?: BookingSide;
}) {
  const [confirm, setConfirm] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const { acceptOffer, counterOffer } = useFestivalOfferActions(
    offer.band_id,
    offer.edition_id,
  );
  const revisions = offer.festival_offer_revisions ?? offer.revisions ?? [];
  const current =
    selectCurrentRevision(revisions, offer.current_revision_id) ?? revisions[0];
  const terms: FestivalTerms =
    current?.terms_snapshot ?? current?.terms ?? offer.terms_snapshot ?? {};
  const expired = terms.expires_at
    ? new Date(terms.expires_at).getTime() < Date.now()
    : false;
  const canAccept = Boolean(
    current &&
    !expired &&
    canAcceptRevision(
      current.proposed_by ?? offer.proposed_by ?? "organiser",
      side,
    ),
  );
  const acceptKey = useStableMutationIdempotencyKey(
    "accept-offer",
    offer.id,
    String(current?.revision_number),
  );
  const accept = () =>
    current &&
    acceptOffer.mutate(
      {
        offerId: offer.id,
        revision: current.revision_number,
        idempotencyKey: acceptKey.idempotencyKey,
      },
      {
        onSuccess: () => {
          acceptKey.markSucceeded();
          setConfirm(false);
          toast.success("Offer accepted; contract awaiting signatures");
        },
        onError: (e) => toast.error(mapBookingError(e).message),
      },
    );
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <CardTitle className="text-base">
            Offer revision{" "}
            {current?.revision_number ?? offer.current_revision ?? "—"}
          </CardTitle>
          <Badge variant={expired ? "destructive" : "secondary"}>
            {expired ? "Expired" : offer.status}
          </Badge>
        </div>
        <CardDescription>
          Proposed by {current?.proposed_by ?? offer.proposed_by ?? "organiser"}{" "}
          · expires {formatBookingDateTime(terms.expires_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <OfferTermsSummary terms={terms} />
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Revision history
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {revisions.map((r) => (
              <li key={r.id}>
                #{r.revision_number} by {r.proposed_by} at{" "}
                {formatBookingDateTime(r.created_at)} —{" "}
                {r.change_summary ?? "No summary"}
              </li>
            ))}
          </ul>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!canAccept || acceptOffer.isPending}
            onClick={() => setConfirm(true)}
          >
            Review and accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={expired || counterOffer.isPending}
            onClick={() => setCounterOpen(true)}
          >
            Counter
          </Button>
        </div>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept current revision?</DialogTitle>
              <DialogDescription>
                Signatures are still required after acceptance. You cannot
                accept a revision proposed by your side.
              </DialogDescription>
            </DialogHeader>
            <OfferTermsSummary terms={terms} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={accept}>
                Accept revision {current?.revision_number}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CounterOfferDialog
          open={counterOpen}
          onOpenChange={setCounterOpen}
          terms={terms}
          revision={current?.revision_number ?? 0}
          isPending={counterOffer.isPending}
          onSubmit={(next, summary, key) =>
            current &&
            counterOffer.mutate(
              {
                offerId: offer.id,
                expectedRevision: current.revision_number,
                terms: next,
                changeSummary: summary || "Counter-offer from booking UI",
                idempotencyKey: key,
              },
              {
                onSuccess: () => {
                  setCounterOpen(false);
                  toast.success("Counter-offer submitted");
                },
                onError: (e) => toast.error(mapBookingError(e).message),
              },
            )
          }
        />
      </CardContent>
    </Card>
  );
}
