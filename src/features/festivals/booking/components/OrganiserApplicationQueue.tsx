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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  mapBookingError,
  type FestivalApplicationStatus,
} from "../bookingTypes";
import type { FestivalApplicationRecord } from "../domainTypes";
import { formatBookingMoney } from "../formatting";
import { useFestivalApplicationActions } from "../hooks";
import { useStableMutationIdempotencyKey } from "../useStableMutationIdempotencyKey";

interface OrganiserApplicationQueueProps {
  title: string;
  statuses: FestivalApplicationStatus[];
  applications: FestivalApplicationRecord[];
  isLoading: boolean;
  editionId?: string;
}

function ApplicationRow({
  application,
  editionId,
}: {
  application: FestivalApplicationRecord;
  editionId?: string;
}) {
  const { reviewApplication } = useFestivalApplicationActions(
    undefined,
    editionId,
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const actionFingerprint = useMemo(
    () => `${application.id}:${rejectReason}`,
    [application.id, rejectReason],
  );
  const reviewKey = useStableMutationIdempotencyKey(
    "review-application",
    application.id,
  );
  const rejectKey = useStableMutationIdempotencyKey(
    "reject-application",
    application.id,
    actionFingerprint,
  );

  const act = (
    action:
      | "move_to_review"
      | "shortlist"
      | "waitlist"
      | "reject"
      | "create_offer",
    reason?: string,
  ) => {
    const key = action === "reject" ? rejectKey : reviewKey;
    reviewApplication.mutate(
      {
        applicationId: application.id,
        action,
        reason,
        idempotencyKey: key.idempotencyKey,
      },
      {
        onSuccess: () => {
          key.markSucceeded();
          setRejectOpen(false);
          toast.success(
            action === "create_offer"
              ? "Offer workflow started"
              : "Application updated",
          );
        },
        onError: (error) => toast.error(mapBookingError(error).message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {application.band_name ?? application.band_id}
          </CardTitle>
          <Badge>{application.status}</Badge>
        </div>
        <CardDescription>
          {application.details?.message ??
            application.application_message ??
            "No message"}{" "}
          · requested{" "}
          {formatBookingMoney(
            application.details?.guarantee_fee_cents,
            application.details?.currency_code,
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!["submitted"].includes(application.status)}
          onClick={() => act("move_to_review")}
        >
          Begin review
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={
            !["submitted", "under_review", "waitlisted"].includes(
              application.status,
            )
          }
          onClick={() => act("shortlist")}
        >
          Shortlist
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={
            !["submitted", "under_review", "shortlisted"].includes(
              application.status,
            )
          }
          onClick={() => act("waitlist")}
        >
          Waitlist
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={["rejected", "withdrawn", "converted_to_contract"].includes(
            application.status,
          )}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <Button
          size="sm"
          disabled={
            !["shortlisted", "under_review"].includes(application.status)
          }
          onClick={() => act("create_offer")}
        >
          Create offer
        </Button>
      </CardContent>
      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open) rejectKey.cancel();
          setRejectOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application?</DialogTitle>
            <DialogDescription>
              Provide a reason for the band. The text is preserved if the server
              rejects the action.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Rejection reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            required
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reviewApplication.isPending}
              onClick={() => act("reject", rejectReason.trim())}
            >
              Reject application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function OrganiserApplicationQueue({
  title,
  statuses,
  applications,
  isLoading,
  editionId,
}: OrganiserApplicationQueueProps) {
  const rows = applications.filter((application) =>
    statuses.includes(application.status),
  );
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        {title} ({rows.length})
      </h3>
      {isLoading ? <p>Loading applications…</p> : null}
      {!isLoading && rows.length
        ? rows.map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              editionId={editionId}
            />
          ))
        : null}
      {!isLoading && !rows.length ? (
        <p className="text-sm text-muted-foreground">
          No applications in this queue.
        </p>
      ) : null}
    </section>
  );
}
