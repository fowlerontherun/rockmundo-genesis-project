import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, DollarSign, ShieldAlert, Star, Users } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getGigCancellationPlayerError,
  type GigCancellationPreview,
  type GigCancellationTier,
  useGigCancellation,
} from "@/hooks/useGigCancellation";
import { formatMerchCurrency } from "@/lib/api/merch";

export interface GigCancellationDialogGig {
  id: string;
  venueName: string;
  scheduledDate: string;
}

interface GigCancellationDialogProps {
  gig: GigCancellationDialogGig | null;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
}

const TIER_LABELS: Record<GigCancellationTier, string> = {
  fourteen_days_plus: "14+ days' notice",
  seven_to_fourteen_days: "7-14 days' notice",
  three_to_seven_days: "3-7 days' notice",
  one_to_three_days: "1-3 days' notice",
  under_twenty_four_hours: "Less than 24 hours' notice",
};

function formatNotice(hours: number): string {
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days} days${remainingHours > 0 ? ` ${remainingHours} hours` : ""}`;
  }
  if (hours >= 1) return `${Math.floor(hours)} hours`;
  return "Less than one hour";
}

export function GigCancellationDialog({
  gig,
  onClose,
  onCancelled,
}: GigCancellationDialogProps) {
  const { isLoading: isCancelling, previewCancellation, cancelGig } = useGigCancellation();
  const [preview, setPreview] = useState<GigCancellationPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;
    setPreview(null);
    setPreviewError(null);
    setReason("");

    if (!gig) return () => { active = false; };

    setIsLoadingPreview(true);
    void previewCancellation(gig.id)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((error) => {
        if (active) setPreviewError(getGigCancellationPlayerError(error));
      })
      .finally(() => {
        if (active) setIsLoadingPreview(false);
      });

    return () => { active = false; };
  }, [gig, previewCancellation]);

  const penalties = useMemo(() => {
    if (!preview) return [];
    return [
      { label: "Fame", value: preview.fame_penalty, icon: Star },
      { label: "Fan sentiment", value: preview.fan_sentiment_penalty, icon: Users },
      { label: "Reputation", value: preview.reputation_penalty, icon: ShieldAlert },
    ];
  }, [preview]);

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!gig || !preview?.can_cancel) return;

    const result = await cancelGig(gig.id, reason.trim() || "Cancelled by band");
    if (!result) return;

    try {
      await onCancelled();
    } finally {
      onClose();
    }
  };

  return (
    <AlertDialog open={Boolean(gig)} onOpenChange={(open) => !open && !isCancelling && onClose()}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this show?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1 text-sm">
              <p>
                Review the exact refund and penalties before cancelling{" "}
                <strong>{gig?.venueName ?? "this show"}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                The show remains in band history, while its member schedule blocks are released.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoadingPreview && (
          <div className="flex items-center justify-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            Calculating the authoritative cancellation terms…
          </div>
        )}

        {previewError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Cancellation terms unavailable</AlertTitle>
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{TIER_LABELS[preview.tier]}</p>
                  <p className="text-xs text-muted-foreground">
                    Approximately {formatNotice(preview.notice_hours)} before showtime
                  </p>
                </div>
              </div>
              <Badge variant={preview.refund_percentage === 100 ? "secondary" : "destructive"}>
                {preview.refund_percentage}% refund
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  Booking fee
                </div>
                <p className="mt-1 font-semibold">{formatMerchCurrency(preview.booking_fee)}</p>
              </div>
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <p className="text-xs text-muted-foreground">Refund</p>
                <p className="mt-1 font-semibold text-green-700 dark:text-green-400">
                  {formatMerchCurrency(preview.refund_amount)}
                </p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">Fee lost</p>
                <p className="mt-1 font-semibold text-destructive">
                  {formatMerchCurrency(preview.non_refundable_amount)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Career penalties</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {penalties.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                    <span className={value > 0 ? "font-semibold text-destructive" : "font-medium text-green-700 dark:text-green-400"}>
                      {value > 0 ? `-${value}` : "None"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!preview.can_cancel && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>This show can no longer be cancelled</AlertTitle>
                <AlertDescription>
                  It has already started, finished, or moved beyond the cancellable state.
                </AlertDescription>
              </Alert>
            )}

            {preview.can_cancel && preview.tier === "under_twenty_four_hours" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Last-minute cancellation</AlertTitle>
                <AlertDescription>
                  There is no booking-fee refund and the largest fame, fan sentiment, and reputation penalties apply.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="gig-cancellation-reason">Reason (optional)</Label>
              <Textarea
                id="gig-cancellation-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 280))}
                placeholder="Tell fans why the show is being cancelled"
                disabled={isCancelling || !preview.can_cancel}
                maxLength={280}
              />
              <p className="text-xs text-muted-foreground">
                Booking-fee refund terms are shown above. City permits and third-party service charges are non-refundable.
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>Keep show</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isLoadingPreview || isCancelling || !preview?.can_cancel}
            onClick={handleConfirm}
          >
            {isCancelling ? "Cancelling…" : "Cancel show and apply penalties"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
