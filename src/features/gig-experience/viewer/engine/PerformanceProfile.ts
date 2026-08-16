import { PERFORMANCE_BUDGETS, type PerformanceTier } from "./ViewerDiagnostics";

/**
 * Phase 6 renderer budgets. Pure projection: given a device tier and the scene
 * scale, decide how much detail the frame loop is allowed to draw and in which
 * order detail is dropped. Degradation order is fixed and documented so that
 * stage action always survives longest:
 *   ambient particles -> background movers -> crowd detail -> service detail
 */
export const DEGRADATION_ORDER = Object.freeze([
  "ambient_particles",
  "background_movers",
  "crowd_detail",
  "service_detail",
] as const);

export type DegradationStep = (typeof DEGRADATION_ORDER)[number];
export type CrowdDetailLevel = "full" | "reduced" | "aggregated";

export interface RenderBudget {
  tier: PerformanceTier;
  /** Device pixel ratio ceiling applied to the backing store. */
  dprCap: number;
  particles: number;
  backgroundMovers: number;
  serviceActors: number;
  representativeCounters: number;
  crowdDetail: CrowdDetailLevel;
  /** Static architecture/background layers may be cached by fingerprint. */
  cacheStaticLayers: boolean;
  appliedDegradations: DegradationStep[];
}

const DPR_CAP: Record<PerformanceTier, number> = { low: 1, standard: 1.5, high: 2 };

/** Above these displayed-counter counts a tier starts shedding detail. */
const CROWD_PRESSURE: Record<PerformanceTier, number> = { low: 900, standard: 2200, high: 3600 };

export function resolveRenderBudget(input: {
  tier: PerformanceTier;
  displayedCrowd: number;
  devicePixelRatio?: number | null;
  reducedMotion?: boolean;
  archetype?: string | null;
}): RenderBudget {
  const tier = input.tier;
  const base = PERFORMANCE_BUDGETS[tier];
  const crowd = Math.max(0, Math.round(input.displayedCrowd || 0));
  const pressure = crowd / Math.max(1, CROWD_PRESSURE[tier]);
  const aggregatedArchetype = input.archetype === "stadium" || input.archetype === "festival";
  const applied: DegradationStep[] = [];

  let particles = base.particles;
  let movers = base.backgroundMovers;
  let crowdDetail: CrowdDetailLevel = "full";
  let serviceActors = tier === "low" ? 18 : tier === "standard" ? 36 : 56;

  if (input.reducedMotion) {
    particles = 0;
    movers = 0;
    applied.push("ambient_particles", "background_movers");
  }

  if (pressure > 1) {
    if (!applied.includes("ambient_particles")) { particles = Math.round(particles * 0.35); applied.push("ambient_particles"); }
  }
  if (pressure > 1.4) {
    if (!applied.includes("background_movers")) { movers = Math.min(movers, 2); applied.push("background_movers"); }
  }
  if (pressure > 1.8 || (aggregatedArchetype && crowd > CROWD_PRESSURE[tier])) {
    crowdDetail = "reduced";
    applied.push("crowd_detail");
  }
  if (pressure > 2.6) {
    crowdDetail = "aggregated";
    serviceActors = Math.round(serviceActors * 0.5);
    applied.push("service_detail");
  }

  const dprCap = Math.min(DPR_CAP[tier], crowd > CROWD_PRESSURE[tier] * 1.8 ? 1 : DPR_CAP[tier]);

  return {
    tier,
    dprCap,
    particles: Math.max(0, particles),
    backgroundMovers: Math.max(0, movers),
    serviceActors: Math.max(4, serviceActors),
    representativeCounters: base.representativeCounters,
    crowdDetail,
    cacheStaticLayers: true,
    appliedDegradations: dedupe(applied),
  };
}

export function effectiveDevicePixelRatio(budget: RenderBudget, devicePixelRatio: number | null | undefined) {
  const dpr = Math.max(1, devicePixelRatio || 1);
  return Math.max(1, Math.min(budget.dprCap, dpr));
}

/** Sample stride used when crowd detail is shed; 1 keeps every counter. */
export function crowdDrawStride(budget: RenderBudget) {
  return budget.crowdDetail === "aggregated" ? 3 : budget.crowdDetail === "reduced" ? 2 : 1;
}

function dedupe(values: DegradationStep[]) {
  const seen = new Set<DegradationStep>();
  const out: DegradationStep[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  // Preserve the documented order for stable diagnostics output.
  return DEGRADATION_ORDER.filter((step) => out.includes(step)) as DegradationStep[];
}
