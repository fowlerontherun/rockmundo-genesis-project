import type { FestivalApplicationRecord, FestivalContractRecord, FestivalOfferRecord, FestivalSetlistRecord } from '../domainTypes';
import { deriveBookingProgress as _deriveBookingProgress, type BookingProgressStepState } from '../progress';

export const deriveBookingProgress = _deriveBookingProgress;

const classes: Record<BookingProgressStepState, string> = {
  complete: 'border-emerald-500/40 bg-emerald-500/10',
  active: 'border-primary/50 bg-primary/10',
  pending: 'border-border bg-muted/30',
};

export function CanonicalBookingProgress(props: { application?: FestivalApplicationRecord; offer?: FestivalOfferRecord; contract?: FestivalContractRecord; setlist?: FestivalSetlistRecord }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {deriveBookingProgress(props as any).map((s) => (
        <div key={s.label} className={`rounded-lg border p-2 text-xs ${classes[s.state] ?? ''}`}>
          <span className="font-medium">{s.label}</span>
          <span className="sr-only"> {s.state}</span>
          <p className="capitalize text-muted-foreground">{s.state}</p>
        </div>
      ))}
    </div>
  );
}
