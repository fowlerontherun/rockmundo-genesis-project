/**
 * Read-only presentation helpers. Expiry and consumption remain authoritative
 * in Supabase; timers here never prolong, revive or mint food.
 */
export type FreshnessUrgency = "expired" | "urgent" | "soon" | "fresh";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function freshnessUrgency(expiresAt: string, nowMs: number): FreshnessUrgency {
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiresMs) || expiresMs <= nowMs)
    return "expired";
  const remaining = expiresMs - nowMs;
  if (remaining <= 6 * HOUR) return "urgent";
  if (remaining <= 24 * HOUR) return "soon";
  return "fresh";
}

export function timeUntilSpoiled(expiresAt: string, nowMs: number): string {
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs) || expiryMs <= nowMs)
    return "Expired";
  const remainingMinutes = Math.ceil((expiryMs - nowMs) / MINUTE);
  if (remainingMinutes < 60) return `${remainingMinutes} min left`;
  if (remainingMinutes < 48 * 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return minutes ? `${hours} hr ${minutes} min left` : `${hours} hr left`;
  }
  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  return hours ? `${days}d ${hours}h left` : `${days}d left`;
}

/** Valid only when the batch has a trustworthy preparation timestamp. */
export function remainingFreshnessPercent(
  preparedAt: string, expiresAt: string, nowMs: number,
): number | null {
  const prepared = Date.parse(preparedAt);
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(prepared) ||
      !Number.isFinite(expires) || expires <= prepared || nowMs < prepared)
    return null;
  return Math.max(0, Math.min(100, Math.round(
    100 * (expires - nowMs) / (expires - prepared),
  )));
}

interface ExpirableStock { expires_at: string }
interface IngredientStock extends ExpirableStock { quantity: number }
interface CookedStock extends ExpirableStock { portions: number }

export function summarizeKitchenFreshness(
  ingredients: readonly IngredientStock[], meals: readonly CookedStock[], nowMs: number,
) {
  let usableIngredients = 0;
  let readyPortions = 0;
  let soonPortions = 0;
  let spoiledPortions = 0;
  let soonIngredientUnits = 0;
  for (const lot of ingredients) {
    if (!Number.isSafeInteger(lot.quantity) || lot.quantity <= 0) continue;
    const status = freshnessUrgency(lot.expires_at, nowMs);
    if (status !== "expired") usableIngredients += lot.quantity;
    if (status === "urgent" || status === "soon") soonIngredientUnits += lot.quantity;
  }
  for (const meal of meals) {
    if (!Number.isSafeInteger(meal.portions) || meal.portions <= 0) continue;
    const status = freshnessUrgency(meal.expires_at, nowMs);
    if (status === "expired") spoiledPortions += meal.portions;
    else {
      readyPortions += meal.portions;
      if (status === "urgent" || status === "soon") soonPortions += meal.portions;
    }
  }
  return { usableIngredients, readyPortions, soonPortions, spoiledPortions, soonIngredientUnits };
}
