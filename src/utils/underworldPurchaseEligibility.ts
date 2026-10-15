import type { UnderworldProduct } from "@/hooks/useUnderworldStore";

/**
 * Mirrors the database's fail-closed instant-effect and recording-boost gates.
 * The DB alone determines actual eligibility, prices and stock.
 * Staged boosters remain disabled until SQL + recording worker pass release gates.
 */
type PurchaseCandidate = Pick<UnderworldProduct,
  "category" | "duration_hours" | "effects" | "price_cash" |
  "price_token_id" | "is_available">;

export const isUnderworldPurchaseSupported = (
  product: PurchaseCandidate,
  recordingQualityBoostEnabled =
    import.meta.env.VITE_UNDERWORLD_RECORDING_BOOSTS_ENABLED === "true",
): boolean => {
  if (
    !product.is_available ||
    product.price_token_id !== null ||
    typeof product.price_cash !== "number" ||
    !Number.isInteger(product.price_cash) ||
    product.price_cash < 1 ||
    product.price_cash > 1_000_000 ||
    !product.effects ||
    typeof product.effects !== "object" ||
    Array.isArray(product.effects)
  ) return false;

  const effects = Object.entries(product.effects);
  if (product.category === "booster") {
    // The first controlled cutover supports exactly one effect, not mixed
    // instant fame/quality/cash/XP products.
    return recordingQualityBoostEnabled &&
      Number.isInteger(product.duration_hours) &&
      (product.duration_hours ?? 0) >= 1 &&
      (product.duration_hours ?? 0) <= 72 &&
      effects.length === 1 &&
      effects[0][0] === "recording_quality_boost" &&
      typeof effects[0][1] === "number" &&
      Number.isInteger(effects[0][1]) &&
      effects[0][1] >= 1 &&
      effects[0][1] <= 50;
  }

  return product.category === "consumable" &&
    (product.duration_hours ?? 0) === 0 &&
    effects.length >= 1 && effects.length <= 3 &&
    effects.every(([key, value]) =>
      ["health", "energy", "fame"].includes(key) &&
      typeof value === "number" &&
      Number.isInteger(value) &&
      Math.abs(value) <= 1_000
    );
};
