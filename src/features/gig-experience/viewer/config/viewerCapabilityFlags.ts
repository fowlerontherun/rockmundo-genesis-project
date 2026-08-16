/**
 * Living Venue Viewer capability flag and staged rollout (Phase 6 release gate).
 *
 * Rollout ladder, in order:
 *   off             → nobody sees the living venue; the prior stage-first renderer path is used.
 *   admin_demo      → only the protected Admin Gig Viewer Demo.
 *   internal_replay → admin demo plus internal/staff player replays.
 *   percentage      → admin demo, internal, plus a deterministic percentage of players.
 *   default         → everyone; the fallback path remains available for one release.
 *
 * Build-time env overrides:
 *   VITE_GIG_VIEWER_LIVING_VENUE_STAGE      "off" | "admin_demo" | "internal_replay" | "percentage" | "default"
 *   VITE_GIG_VIEWER_LIVING_VENUE_PERCENTAGE "0".."100"
 *   VITE_GIG_VIEWER_LEGACY_FALLBACK         "true" | "false"  (one-release fallback availability)
 */

export const VIEWER_ROLLOUT_STAGES = ["off", "admin_demo", "internal_replay", "percentage", "default"] as const;
export type ViewerRolloutStage = (typeof VIEWER_ROLLOUT_STAGES)[number];

export type ViewerAudience = "admin_demo" | "internal" | "player";

export interface ViewerCapabilityContext {
  /** Who is watching. The admin demo always reports `admin_demo`. */
  audience: ViewerAudience;
  /** Stable identifier used for deterministic percentage bucketing (gig id, replay id, or profile id). */
  subjectId?: string | null;
  /** Explicit stage override, used by tests and the demo's rollout simulator. */
  stage?: ViewerRolloutStage | null;
  /** Explicit percentage override (0-100). */
  percentage?: number | null;
  /** Explicit fallback availability override. */
  legacyFallbackAvailable?: boolean | null;
}

export interface ViewerCapabilities {
  stage: ViewerRolloutStage;
  percentage: number;
  audience: ViewerAudience;
  /** Deterministic 0-99 bucket for the subject; -1 when no subject is supplied. */
  bucket: number;
  /** True when the full living venue scene (environment, architecture, activity, signage) renders. */
  livingVenueEnabled: boolean;
  /** True while the prior stage-first renderer path must stay reachable. */
  legacyFallbackAvailable: boolean;
  /** Short, log-safe reason for the resolved decision. */
  reason:
    | "stage_off"
    | "admin_demo"
    | "internal_audience"
    | "percentage_included"
    | "percentage_excluded"
    | "stage_default"
    | "audience_not_reached";
}

const readEnv = (key: string): string | undefined => {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.[key];
  } catch {
    return undefined;
  }
};

function parseStage(raw: string | undefined, fallback: ViewerRolloutStage): ViewerRolloutStage {
  const value = (raw ?? "").trim().toLowerCase();
  return (VIEWER_ROLLOUT_STAGES as readonly string[]).includes(value) ? (value as ViewerRolloutStage) : fallback;
}

function parsePercentage(raw: string | number | null | undefined, fallback: number): number {
  const value = typeof raw === "number" ? raw : Number.parseFloat((raw ?? "").toString());
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Stable FNV-1a bucket so a subject never flips between 0-99 buckets across sessions or devices. */
export function rolloutBucket(subjectId: string | null | undefined): number {
  const subject = (subjectId ?? "").trim();
  if (!subject) return -1;
  let hash = 2166136261;
  for (let index = 0; index < subject.length; index += 1) {
    hash = Math.imul(hash ^ subject.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % 100;
}

export function resolveViewerCapabilities(context: ViewerCapabilityContext): ViewerCapabilities {
  const stage = context.stage ?? parseStage(readEnv("VITE_GIG_VIEWER_LIVING_VENUE_STAGE"), "default");
  const percentage = parsePercentage(
    context.percentage ?? readEnv("VITE_GIG_VIEWER_LIVING_VENUE_PERCENTAGE"),
    100,
  );
  const legacyFallbackAvailable =
    context.legacyFallbackAvailable ?? parseBool(readEnv("VITE_GIG_VIEWER_LEGACY_FALLBACK"), true);
  const bucket = rolloutBucket(context.subjectId);
  const audience = context.audience;

  const decide = (): { enabled: boolean; reason: ViewerCapabilities["reason"] } => {
    if (stage === "off") return { enabled: false, reason: "stage_off" };
    if (stage === "default") return { enabled: true, reason: "stage_default" };
    if (audience === "admin_demo") return { enabled: true, reason: "admin_demo" };
    if (stage === "admin_demo") return { enabled: false, reason: "audience_not_reached" };
    if (audience === "internal") return { enabled: true, reason: "internal_audience" };
    if (stage === "internal_replay") return { enabled: false, reason: "audience_not_reached" };
    if (percentage >= 100) return { enabled: true, reason: "percentage_included" };
    if (percentage <= 0 || bucket < 0) return { enabled: false, reason: "percentage_excluded" };
    return bucket < percentage
      ? { enabled: true, reason: "percentage_included" }
      : { enabled: false, reason: "percentage_excluded" };
  };

  const decision = decide();
  return {
    stage,
    percentage,
    audience,
    bucket,
    livingVenueEnabled: decision.enabled,
    legacyFallbackAvailable,
    reason: decision.reason,
  };
}
