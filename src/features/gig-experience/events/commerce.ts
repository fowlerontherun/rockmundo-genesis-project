import type { GigReplayCommerceSnapshot } from "./types";

const MAX_COMMERCE_LINES = 400;
const MAX_TEXT_LENGTH = 160;

/**
 * Stored JSON is an untrusted presentation boundary. Reject the complete
 * commerce snapshot when any authoritative fact is malformed so the viewer
 * can fall back safely without partially inventing a settlement.
 */
export function normalizeGigReplayCommerceSnapshot(value: unknown): GigReplayCommerceSnapshot | null {
  if (!isRecord(value)) return null;

  const formulaVersion = boundedString(value.formulaVersion);
  const settlementId = boundedString(value.settlementId);
  const merchandise = value.merchandise;
  const bar = value.bar;
  if (!formulaVersion || !settlementId || !isRecord(merchandise) || !isRecord(bar)) return null;
  if (merchandise.owner !== "band" || !Array.isArray(merchandise.lines) || merchandise.lines.length > MAX_COMMERCE_LINES) return null;
  if (!isNonNegativeInteger(merchandise.itemsSold) || !isNonNegativeInteger(merchandise.grossRevenue) || !isNonNegativeInteger(merchandise.cost)) return null;

  const lines: GigReplayCommerceSnapshot["merchandise"]["lines"] = [];
  for (const candidate of merchandise.lines) {
    if (!isRecord(candidate)) return null;
    const merchandiseId = boundedString(candidate.merchandiseId);
    const itemType = boundedString(candidate.itemType);
    const name = boundedString(candidate.name);
    const variantId = candidate.variantId == null ? null : boundedString(candidate.variantId);
    if (!merchandiseId || !itemType || !name || (candidate.variantId != null && !variantId)) return null;
    if (!isNonNegativeInteger(candidate.quantity) || !isNonNegativeInteger(candidate.unitPrice) || !isNonNegativeInteger(candidate.gross)) return null;
    if (candidate.gross !== candidate.quantity * candidate.unitPrice) return null;
    lines.push({
      merchandiseId,
      variantId,
      itemType,
      name,
      quantity: candidate.quantity,
      unitPrice: candidate.unitPrice,
      gross: candidate.gross,
    });
  }

  const lineQuantity = lines.reduce((total, line) => total + line.quantity, 0);
  const lineGross = lines.reduce((total, line) => total + line.gross, 0);
  if (!Number.isSafeInteger(lineQuantity) || !Number.isSafeInteger(lineGross)) return null;
  if (lineQuantity !== merchandise.itemsSold || lineGross !== merchandise.grossRevenue) return null;

  if (!isNonNegativeInteger(bar.drinksServed) || !isNonNegativeInteger(bar.grossRevenue) || !isNonNegativeInteger(bar.venueRevenue) || !isNonNegativeInteger(bar.bandEntitlement)) return null;
  if (bar.owner !== "venue" && bar.owner !== "shared_by_confirmed_booking") return null;
  if (bar.shareSource !== "confirmed_booking" && bar.shareSource !== "venue_fallback") return null;
  const splitRevenue = bar.venueRevenue + bar.bandEntitlement;
  if (!Number.isSafeInteger(splitRevenue) || splitRevenue !== bar.grossRevenue) return null;
  if (bar.owner === "venue" && bar.bandEntitlement !== 0) return null;
  if (bar.owner === "shared_by_confirmed_booking" && (bar.shareSource !== "confirmed_booking" || bar.bandEntitlement === 0)) return null;
  if (bar.shareSource === "venue_fallback" && bar.owner !== "venue") return null;

  return {
    formulaVersion,
    settlementId,
    merchandise: {
      itemsSold: merchandise.itemsSold,
      grossRevenue: merchandise.grossRevenue,
      cost: merchandise.cost,
      owner: "band",
      lines,
    },
    bar: {
      drinksServed: bar.drinksServed,
      grossRevenue: bar.grossRevenue,
      venueRevenue: bar.venueRevenue,
      bandEntitlement: bar.bandEntitlement,
      owner: bar.owner,
      shareSource: bar.shareSource,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT_LENGTH ? value : null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
