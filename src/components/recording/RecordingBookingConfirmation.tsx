import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarClock, CheckCircle2, Clock, MapPin, Music2, Wallet } from "lucide-react";
import { format } from "date-fns";

export interface RecordingBookingSummary {
  sessionId: string;
  studioName: string;
  songTitle: string;
  producerName?: string | null;
  recordingType: "demo" | "professional";
  durationHours: number;
  scheduledStart: string;
  scheduledEnd: string;
  totalCost: number;
  payer: "band" | "personal";
  payerName?: string | null;
  projectionPending?: boolean;
}

interface RecordingBookingConfirmationProps {
  open: boolean;
  summary: RecordingBookingSummary | null;
  isCancelling?: boolean;
  isRepairing?: boolean;
  onRepair: () => void;
  onClose: () => void;
  onCancelSession: () => void;
  onReschedule: () => void;
}

export const RecordingBookingConfirmation = ({
  open,
  summary,
  isCancelling = false,
  isRepairing = false,
  onRepair,
  onClose,
  onCancelSession,
  onReschedule,
}: RecordingBookingConfirmationProps) => {
  if (!summary) return null;

  const start = new Date(summary.scheduledStart);
  const end = new Date(summary.scheduledEnd);
  const validWindow = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime());

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isCancelling && !isRepairing) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Session booked
          </DialogTitle>
          <DialogDescription>
            {summary.projectionPending
              ? "Your payment and studio reservation are confirmed. Diary entries or notifications still need repair."
              : "Your studio time is locked in and the diary is blocked for everyone involved."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="font-semibold">
                {validWindow ? format(start, "EEEE d MMMM yyyy") : "Scheduled"}
              </div>
              <div className="text-muted-foreground">
                {validWindow
                  ? `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`
                  : "Time window unavailable"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>{summary.durationHours} hour window</span>
            <Badge variant="outline" className="capitalize">
              {summary.recordingType}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{summary.studioName}</span>
          </div>

          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-primary" />
            <span>{summary.songTitle}</span>
            {summary.producerName && (
              <span className="text-muted-foreground">· {summary.producerName}</span>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Paid by {summary.payer === "band" ? summary.payerName || "your band" : "you"}
            </span>
            <span className="font-semibold">${summary.totalCost.toLocaleString()}</span>
          </div>
        </div>

        {summary.projectionPending && (
          <div role="status" className="rounded-md border border-amber-500/50 p-3 text-sm">
            <p className="font-semibold">Booking is paid — do not book again.</p>
            <p className="mt-1 text-muted-foreground">Retry diary and notification delivery for this same session without paying again.</p>
            <Button type="button" className="mt-2" variant="outline" onClick={onRepair}
              disabled={isCancelling || isRepairing}>
              {isRepairing ? "Repairing…" : "Repair booking details"}
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Cancelling before the session starts frees the studio slot, clears the diary blocks and
          refunds the full cost. Rescheduling cancels this booking and takes you back to pick a new
          date and time slot.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={onCancelSession}
              disabled={isCancelling || isRepairing}
            >
              {isCancelling ? "Cancelling…" : "Cancel session"}
            </Button>
            <Button variant="outline" onClick={onReschedule} disabled={isCancelling || isRepairing}>
              Reschedule
            </Button>
          </div>
          <Button onClick={onClose} disabled={isCancelling || isRepairing}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingBookingConfirmation;
