export const REHEARSAL_RSVP_LOCK_MINUTES = 60;

export function getRehearsalRsvpDeadline(scheduledStart: string | Date): Date {
  const start = scheduledStart instanceof Date ? scheduledStart : new Date(scheduledStart);
  return new Date(start.getTime() - REHEARSAL_RSVP_LOCK_MINUTES * 60 * 1000);
}

export function isRehearsalRsvpOpen(status: string | null | undefined, participationStatus: string | null | undefined, scheduledStart: string | Date, now = new Date()): boolean {
  return status === "scheduled"
    && !["attended", "missed"].includes(participationStatus ?? "")
    && now < getRehearsalRsvpDeadline(scheduledStart);
}
