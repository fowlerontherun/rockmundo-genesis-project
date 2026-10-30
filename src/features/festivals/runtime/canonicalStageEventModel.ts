/**
 * Canonical annual-edition stage event protocol. Match the transition rules in
 * private.capture_canonical_festival_stage_evidence in the SQL reconciliation.
 *
 * This models authoritative events only. Timetable clock positions, NPC
 * fillers and decorative crowds must not be converted into event records.
 */
export const canonicalStageStates = [
  "ready", "starting", "live", "delayed", "completed", "cancelled",
] as const;
export type CanonicalStageState = (typeof canonicalStageStates)[number];

const transitions: Record<CanonicalStageState, readonly CanonicalStageState[]> = {
  ready: ["starting", "delayed", "cancelled"],
  starting: ["live", "delayed", "cancelled"],
  live: ["delayed", "completed", "cancelled"],
  delayed: ["starting", "live", "cancelled"],
  completed: [],
  cancelled: [],
};

const initialStates: readonly CanonicalStageState[] = ["ready", "delayed", "cancelled"];

/** Returns false for terminal reactivation and for events without a trusted start. */
export function canAdvanceCanonicalStageState(
  previous: CanonicalStageState | null,
  next: CanonicalStageState,
): boolean {
  return previous === null ? initialStates.includes(next) : transitions[previous].includes(next);
}
