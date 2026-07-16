import type {
  FestivalApplicationRecord,
  FestivalContractRecord,
  FestivalOfferRecord,
  FestivalSetlistRecord,
} from "../domainTypes";
import {
  deriveBookingProgress,
  type BookingProgressStepState,
} from "../progress";

export { deriveBookingProgress };

const classes: Record<BookingProgressStepState, string> = {
  incomplete: "border-border/60 bg-muted/30 text-muted-foreground",
  active: "border-primary/60 bg-primary/10 text-primary",
  complete: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600",
  blocked: "border-amber-500/50 bg-amber-500/10 text-amber-600",
  failed: "border-destructive/60 bg-destructive/10 text-destructive",
  cancelled: "border-border/60 bg-muted/40 text-muted-foreground line-through",
};
export function CanonicalBookingProgress(props: {
  application?: FestivalApplicationRecord;
  offer?: FestivalOfferRecord;
  contract?: FestivalContractRecord;
  setlist?: FestivalSetlistRecord;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {deriveBookingProgress(props).map((s) => (
        <div
          key={s.label}
          className={`rounded-lg border p-2 text-xs ${classes[s.state]}`}
        >
          <span className="font-medium">{s.label}</span>
          <span className="sr-only"> {s.state}</span>
          <p className="capitalize text-muted-foreground">{s.state}</p>
        </div>
      ))}
    </div>
  );
}
