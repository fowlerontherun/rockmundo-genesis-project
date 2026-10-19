/** Cache identity must include the evidence shape: live reads return the newest
 * 24 actions while completed replays require the entire immutable 120-event
 * server-bounded timeline. Sharing a key can silently truncate a replay.
 */
export type DjStageEvidenceMode = "live" | "replay";

export function djStageEvidenceQueryKey(
  profileId: string, bookingId: string, mode: DjStageEvidenceMode,
): readonly ["dj-stage-mix-evidence", string, string, DjStageEvidenceMode] {
  return ["dj-stage-mix-evidence", profileId, bookingId, mode] as const;
}

export function djStageEvidencePageSize(mode: DjStageEvidenceMode): number {
  return mode === "replay" ? 120 : 24;
}
