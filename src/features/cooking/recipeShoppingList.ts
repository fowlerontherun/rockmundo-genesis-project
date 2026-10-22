// Pure, read-only shopping arithmetic. Server RPCs retain all authority over
// charges, ingredient grants, stock and recipe unlocks.
export interface ShoppingRequirement {
  ingredient_slug: string;
  units_required: number;
}
export interface OwnedIngredientLot {
  ingredient_slug: string;
  quantity: number;
  expires_at: string;
}
export interface ShoppingCityOffer {
  ingredient_slug: string;
  stock: number;
  is_active: boolean;
  unit_price: number;
  local_speciality: boolean;
}
export interface IngredientShoppingLine {
  slug: string;
  required: number;
  owned: number;
  missing: number;
  localStock: number;
  pricePerUnit: number | null;
  subtotal: number | null;
  localSpeciality: boolean;
}
export interface RecipeShoppingSummary {
  lines: IngredientShoppingLine[];
  canCook: boolean;
  canBuyMissingLocally: boolean;
  missingTotal: number;
  shoppingCost: number | null;
}

export function calculateCookingShoppingList(
  requirements: readonly ShoppingRequirement[],
  lots: readonly OwnedIngredientLot[],
  offers: readonly ShoppingCityOffer[],
  nowMs: number,
): RecipeShoppingSummary {
  const owned = new Map<string, number>();
  for (const lot of lots) {
    if (lot.quantity <= 0 || !Number.isFinite(Date.parse(lot.expires_at))
        || Date.parse(lot.expires_at) <= nowMs) continue;
    owned.set(lot.ingredient_slug, (owned.get(lot.ingredient_slug) ?? 0) + lot.quantity);
  }
  const activeOffers = new Map(offers.filter(offer => offer.is_active)
    .map(offer => [offer.ingredient_slug, offer]));
  const lines: IngredientShoppingLine[] = requirements.map((requirement) => {
    const have = Math.max(0, owned.get(requirement.ingredient_slug) ?? 0);
    const required = Math.max(0, requirement.units_required);
    const missing = Math.max(0, required - have);
    const offer = activeOffers.get(requirement.ingredient_slug);
    const localStock = offer ? Math.max(0, offer.stock) : 0;
    const pricePerUnit = offer && offer.unit_price > 0 ? offer.unit_price : null;
    return {
      slug: requirement.ingredient_slug,
      required, owned: have, missing, localStock, pricePerUnit,
      localSpeciality: Boolean(offer?.local_speciality),
      subtotal: missing === 0 ? 0 :
        localStock >= missing && pricePerUnit !== null ? missing * pricePerUnit : null,
    };
  });
  const canCook = lines.length > 0 && lines.every(line => line.missing === 0);
  const canBuyMissingLocally = lines.length > 0 &&
    lines.every(line => line.missing === 0 || line.subtotal !== null);
  return {
    lines, canCook, canBuyMissingLocally,
    missingTotal: lines.reduce((total, line) => total + line.missing, 0),
    shoppingCost: canBuyMissingLocally
      ? lines.reduce((total, line) => total + (line.subtotal ?? 0), 0)
      : null,
  };
}
