/** Presentation-only DJ arm poses. Never changes audio, beat grid or game scoring. */
export type DjBoothAction =
  | "dj_cue_a" | "dj_cue_b"
  | "dj_tempo_a" | "dj_tempo_b"
  | "dj_crossfade";

export type DjBoothGripTargets = {
  left: readonly [number, number, number];
  right: readonly [number, number, number];
  influence: number;
};

/**
 * Fixed station targets in the shared turntablism rig's local space.
 * A bounded 2-second pulse follows each *server-recorded* mixer event.
 * Deterministic from action/progress, so seeking backwards reconstructs it.
 */
export function djBoothGripTargets(
  action: string | null,
  progress: number,
): DjBoothGripTargets | null {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return null;
  if (!action || !([
    "dj_cue_a", "dj_cue_b", "dj_tempo_a", "dj_tempo_b", "dj_crossfade",
  ] as string[]).includes(action)) return null;

  const influence = Math.sin(Math.PI * progress);
  // The deck faces the audience at +Z; the right and left platters
  // are x=-.34 and x=+.34 in its local coordinates.
  const neutralLeft: readonly [number, number, number] = [.26, 1.04, .44];
  const neutralRight: readonly [number, number, number] = [-.25, 1.04, .44];
  const left = action === "dj_cue_a" ? [.34, 1.075, .53] as const
    : action === "dj_tempo_a" ? [.49, 1.095, .68] as const
      : neutralLeft;
  const right = action === "dj_cue_b" ? [-.34, 1.075, .53] as const
    : action === "dj_tempo_b" ? [-.49, 1.095, .68] as const
      : action === "dj_crossfade" ? [0, 1.085, .52] as const
        : neutralRight;
  return { left, right, influence };
}
