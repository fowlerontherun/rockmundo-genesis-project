import type { CrowdTuningOptions } from "./CrowdTuning";

export type CrowdTuningSource = "explicit" | "demo" | "replay" | "global" | "built_in";

export function resolveCrowdTuning({
  explicit,
  demoMode,
  demo,
  replay,
  global,
}: {
  explicit?: Partial<CrowdTuningOptions> | null;
  demoMode: boolean;
  demo?: CrowdTuningOptions | null;
  replay?: Partial<CrowdTuningOptions> | null;
  global?: CrowdTuningOptions | null;
}): { tuning: Partial<CrowdTuningOptions> | null; source: CrowdTuningSource } {
  if (explicit) return { tuning: explicit, source: "explicit" };
  if (demoMode && demo) return { tuning: demo, source: "demo" };
  if (replay) return { tuning: replay, source: "replay" };
  if (global) return { tuning: global, source: "global" };
  return { tuning: null, source: "built_in" };
}
