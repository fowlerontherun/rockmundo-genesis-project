import type { GigViewerReplay } from "../../events/types";
import type { ActivityEvidenceMode } from "./ViewerDiagnostics";
import { verifyReplayChecksum, type ReplayChecksumVerdict } from "./ReplayChecksum";

/**
 * Phase 5 inspector contract. Pure, read-only projection of an already loaded
 * replay: it never fetches, mutates, or recalculates settlement facts, and it
 * deliberately excludes signed asset URLs and private cost/ownership data.
 */
export interface ReplayEvidenceSummary {
  replayId: string;
  gigId: string;
  viewerVersion: number;
  eventSchemaVersion: number;
  supportedEventSchemaVersion: number;
  schemaCompatibility: "current" | "legacy" | "unsupported";
  status: GigViewerReplay["status"];
  resultAvailable: boolean;
  checksumPresent: boolean;
  /** Recomputed from the immutable payload: proves regeneration produced identical facts. */
  checksumVerdict: ReplayChecksumVerdict;
  computedChecksum: string;
  simulationSeedFingerprint: string;
  durationMs: number;
  eventCount: number;
  songStartCount: number;
  eventCountsByPhase: Readonly<Record<string, number>>;
  evidenceMode: ActivityEvidenceMode;
  /** True when quantities are spread across the replay by deterministic inference. */
  presentationInference: boolean;
  commerce: {
    present: boolean;
    formulaVersion: string | null;
    settlementId: string | null;
    merchandiseItemsSold: number | null;
    merchandiseGrossRevenue: number | null;
    merchandiseLineCount: number | null;
    barDrinksServed: number | null;
    barGrossRevenue: number | null;
    barOwner: string | null;
    barShareSource: string | null;
    savedEventCount: number;
  };
  validationFailures: readonly string[];
}

export function buildReplayEvidenceSummary(input: {
  replay: GigViewerReplay;
  supportedEventSchemaVersion: number;
  validationFailures?: readonly string[] | null;
}): ReplayEvidenceSummary {
  const { replay } = input;
  const eventCountsByPhase: Record<string, number> = {};
  let songStartCount = 0;
  for (const event of replay.events) {
    eventCountsByPhase[event.phase] = (eventCountsByPhase[event.phase] ?? 0) + 1;
    if (event.visualPayload.type === "song_start") songStartCount += 1;
  }

  const commerce = replay.commerce ?? null;
  const savedEventCount = commerce?.events?.length ?? 0;
  const evidenceMode: ActivityEvidenceMode = savedEventCount > 0 ? "event_replay" : commerce ? "aggregate" : "ambient";
  const checksum = verifyReplayChecksum(replay);

  return {
    replayId: replay.id,
    gigId: replay.gigId,
    viewerVersion: replay.viewerVersion,
    eventSchemaVersion: replay.eventSchemaVersion,
    supportedEventSchemaVersion: input.supportedEventSchemaVersion,
    schemaCompatibility:
      replay.eventSchemaVersion === input.supportedEventSchemaVersion
        ? "current"
        : replay.eventSchemaVersion < input.supportedEventSchemaVersion
          ? "legacy"
          : "unsupported",
    status: replay.status,
    resultAvailable: replay.resultAvailable !== false,
    checksumPresent: checksum.stored !== null,
    checksumVerdict: checksum.verdict,
    computedChecksum: checksum.computed,
    simulationSeedFingerprint: seedFingerprint(replay.simulationSeed),
    durationMs: replay.durationMs,
    eventCount: replay.events.length,
    songStartCount,
    eventCountsByPhase: Object.freeze(eventCountsByPhase),
    evidenceMode,
    presentationInference: evidenceMode === "aggregate",
    commerce: {
      present: Boolean(commerce),
      formulaVersion: commerce?.formulaVersion ?? null,
      settlementId: commerce?.settlementId ?? null,
      merchandiseItemsSold: commerce?.merchandise.itemsSold ?? null,
      merchandiseGrossRevenue: commerce?.merchandise.grossRevenue ?? null,
      merchandiseLineCount: commerce?.merchandise.lines.length ?? null,
      barDrinksServed: commerce?.bar.drinksServed ?? null,
      barGrossRevenue: commerce?.bar.grossRevenue ?? null,
      barOwner: commerce?.bar.owner ?? null,
      barShareSource: commerce?.bar.shareSource ?? null,
      savedEventCount,
    },
    validationFailures: Object.freeze([...(input.validationFailures ?? [])]),
  };
}

/** Seeds can embed identifiers, so the inspector only ever shows a fingerprint. */
function seedFingerprint(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return `seed-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
