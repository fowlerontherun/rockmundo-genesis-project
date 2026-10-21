// Pure domain rules only. Only a trusted database transaction may mint, transfer
// or consume these batches. Do not persist browser-calculated quantities or expiry.
export interface FoodBatch {
  id: string;
  profileId: string;
  recipeSlug: string;
  portions: number;
  preparedAt: string;
  expiresAt: string;
  quality: number;
}
export interface IngredientLot {
  id: string;
  profileId: string;
  ingredientSlug: string;
  quantity: number;
  expiresAt: string;
}
export type FoodAvailability = "fresh" | "expired" | "empty";

export function foodAvailability(batch: FoodBatch, nowMs: number): FoodAvailability {
  if (batch.portions <= 0) return "empty";
  const expiry = Date.parse(batch.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiry) || nowMs >= expiry) return "expired";
  return "fresh";
}

export function remainingShelfLifeMs(batch: FoodBatch, nowMs: number): number {
  const expiry = Date.parse(batch.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiry)) return 0;
  return Math.max(0, expiry - nowMs);
}

/** The earliest input expiry caps every finished portion's lifespan. */
export function calculateBatchExpiry(
  preparedAt: string,
  recipeShelfLifeHours: number,
  consumedLots: readonly Pick<IngredientLot, "expiresAt">[],
): string | null {
  const preparedMs = Date.parse(preparedAt);
  if (!Number.isFinite(preparedMs) || !Number.isFinite(recipeShelfLifeHours) ||
    recipeShelfLifeHours <= 0 || consumedLots.length === 0) return null;
  const expiryTimes = consumedLots.map((lot) => Date.parse(lot.expiresAt));
  if (expiryTimes.some((value) => !Number.isFinite(value) || value <= preparedMs)) return null;
  const expiry = Math.min(preparedMs + recipeShelfLifeHours * 3_600_000, ...expiryTimes);
  if (!Number.isFinite(expiry)) return null;
  return new Date(expiry).toISOString();
}

export function canConsumePortions(batch: FoodBatch, count: number, nowMs: number): boolean {
  return Number.isSafeInteger(count) && count > 0 &&
    Number.isSafeInteger(batch.portions) && batch.portions >= count &&
    foodAvailability(batch, nowMs) === "fresh";
}

/** Presentation grouping only; preserves expiry and batch identity. */
export function sortBatchesByExpiry(batches: readonly FoodBatch[]): FoodBatch[] {
  return [...batches].sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}
