/**
 * Canonical annual-edition stage event protocol. Match the transition rules in
 * private.capture_canonical_festival_stage_evidence in the SQL reconciliation.
 *
 * This models authoritative events only. Timetable clock positions, NPC
 * fillers and decorative crowds must not be converted into event records.
 */
export const canonicalStageStates = [
  "ready", "changeover", "soundcheck", "starting", "live", "delayed", "completed", "cancelled",
] as const;
export type CanonicalStageState = (typeof canonicalStageStates)[number];

export const canonicalStageTransitions: Record<CanonicalStageState, readonly CanonicalStageState[]> = {
  ready: ["changeover", "soundcheck", "starting", "delayed", "cancelled"],
  changeover: ["soundcheck", "starting", "delayed", "cancelled"],
  soundcheck: ["starting", "delayed", "cancelled"],
  starting: ["live", "delayed", "cancelled"],
  live: ["delayed", "completed", "cancelled"],
  delayed: ["changeover", "soundcheck", "starting", "live", "cancelled"],
  completed: [],
  cancelled: [],
};

export const initialCanonicalStageStates: readonly CanonicalStageState[] = ["ready", "changeover", "soundcheck", "delayed", "cancelled"];

/** Returns false for terminal reactivation and for events without a trusted start. */
export function canAdvanceCanonicalStageState(
  previous: CanonicalStageState | null,
  next: CanonicalStageState,
): boolean {
  return previous === null ? initialCanonicalStageStates.includes(next) : canonicalStageTransitions[previous].includes(next);
}
