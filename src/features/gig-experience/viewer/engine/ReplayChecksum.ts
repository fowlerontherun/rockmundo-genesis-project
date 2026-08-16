import type { GigViewerReplay } from "../../events/types";

/**
 * Deterministic replay checksum used to prove regeneration/recovery is idempotent
 * (Phase 5 exit gate). It hashes only immutable payload facts, in a canonical order,
 * so two regenerations from identical inputs produce identical checksums while any
 * meaningful payload change produces a different one.
 *
 * The checksum never includes signed asset URLs or private cost/ownership data.
 */
export const REPLAY_CHECKSUM_VERSION = "replay-checksum-v1" as const;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "null";
  return JSON.stringify(value);
}

function hash(input: string): string {
  let h1 = 2166136261;
  let h2 = 2463534242;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 + code + index, 2654435761) ^ (h2 >>> 15);
  }
  const left = (h1 >>> 0).toString(16).padStart(8, "0");
  const right = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${left}${right}`;
}

/** Canonical, order-stable projection of the facts a replay is allowed to assert. */
export function canonicalReplayPayload(replay: GigViewerReplay) {
  return {
    gigId: replay.gigId,
    viewerVersion: replay.viewerVersion,
    eventSchemaVersion: replay.eventSchemaVersion,
    durationMs: replay.durationMs,
    simulationSeed: replay.simulationSeed ?? null,
    events: [...replay.events]
      .sort((a, b) => a.sequence - b.sequence || a.scheduledOffsetMs - b.scheduledOffsetMs)
      .map((event) => ({
        sequence: event.sequence,
        scheduledOffsetMs: event.scheduledOffsetMs,
        phase: event.phase,
        visualPayload: event.visualPayload,
      })),
    commerce: replay.commerce
      ? {
          formulaVersion: replay.commerce.formulaVersion,
          settlementId: replay.commerce.settlementId,
          merchandise: {
            itemsSold: replay.commerce.merchandise.itemsSold,
            grossRevenue: replay.commerce.merchandise.grossRevenue,
            lines: [...replay.commerce.merchandise.lines]
              .map((line) => ({
                merchandiseId: line.merchandiseId,
                variantId: line.variantId ?? null,
                itemType: line.itemType,
                name: line.name,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                gross: line.gross,
              }))
              .sort((a, b) => (a.merchandiseId < b.merchandiseId ? -1 : a.merchandiseId > b.merchandiseId ? 1 : 0)),
          },
          bar: {
            drinksServed: replay.commerce.bar.drinksServed,
            grossRevenue: replay.commerce.bar.grossRevenue,
            owner: replay.commerce.bar.owner,
            shareSource: replay.commerce.bar.shareSource,
          },
          events: [...(replay.commerce.events ?? [])]
            .map((event) => ({
              id: event.id,
              atMs: event.atMs,
              service: event.service,
              quantity: event.quantity,
              itemType: event.itemType ?? null,
            }))
            .sort((a, b) => a.atMs - b.atMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        }
      : null,
  };
}

export function computeReplayChecksum(replay: GigViewerReplay): string {
  return `${REPLAY_CHECKSUM_VERSION}:${hash(stableStringify(canonicalReplayPayload(replay)))}`;
}

export type ReplayChecksumVerdict = "matched" | "mismatched" | "absent";

export function verifyReplayChecksum(replay: GigViewerReplay): {
  verdict: ReplayChecksumVerdict;
  computed: string;
  stored: string | null;
} {
  const computed = computeReplayChecksum(replay);
  const stored = typeof replay.checksum === "string" && replay.checksum.length > 0 ? replay.checksum : null;
  if (!stored) return { verdict: "absent", computed, stored: null };
  return { verdict: stored === computed ? "matched" : "mismatched", computed, stored };
}
