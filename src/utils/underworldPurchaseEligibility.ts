import type { UnderworldProduct } from "@/hooks/useUnderworldStore";

/**
 * Mirrors the initial, fail-closed SQL underworld_safe_instant_effects gate.
 * The database remains authoritative for final price, stock and eligibility.
 */
export const isUnderworldPurchaseSupported = (
  product: Pick<UnderworldProduct, "category" | "duration_hours" | "effects" | "price_cash" | "is_available">,
): boolean => {
  if (
    !product.is_available ||
    product.category !== "consumable" ||
    (product.duration_hours ?? 0) !== 0 ||
    typeof product.price_cash !== "number" ||
    !Number.isInteger(product.price_cash) ||
    product.price_cash < 1 ||
    product.price_cash > 1_000_000 ||
    !product.effects ||
    typeof product.effects !== "object" ||
    Array.isArray(product.effects)
  ) return false;

  const effects = Object.entries(product.effects);
  return effects.length >= 1 && effects.length <= 3 && effects.every(([key, value]) =>
    ["health", "energy", "fame"].includes(key) &&
    typeof value === "number" &&
    Number.isInteger(value) &&
    Math.abs(value) <= 1_000
  );
};
