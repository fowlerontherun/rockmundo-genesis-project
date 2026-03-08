/**
 * Genre-matched clothing bonus system.
 * Players wearing clothing that matches the genre of a gig receive
 * fan interaction and merchandise sale bonuses.
 */

export interface ClothingBonusResult {
  fanInteractionBonus: number;   // multiplier, e.g. 1.05
  merchSalesBonus: number;       // multiplier, e.g. 1.03
  matchedItems: number;
}

/**
 * Calculate bonuses from genre-matched clothing worn at a gig.
 * @param equippedGenres - genre_style values of all clothing the player is wearing
 * @param gigGenre - genre of the gig being performed
 */
export function calculateClothingGigBonus(
  equippedGenres: string[],
  gigGenre: string,
): ClothingBonusResult {
  const normalise = (g: string) => g.toLowerCase().replace(/[\s&-]+/g, '_');
  const normalGig = normalise(gigGenre);

  const matchedItems = equippedGenres.filter(
    (g) => normalise(g) === normalGig,
  ).length;

  if (matchedItems === 0) {
    return { fanInteractionBonus: 1, merchSalesBonus: 1, matchedItems: 0 };
  }

  // +5% fan interaction per matched item (cap at 3 items → +15%)
  const fanBonus = 1 + Math.min(matchedItems, 3) * 0.05;
  // +3% merch sales per matched item (cap at 3 items → +9%)
  const merchBonus = 1 + Math.min(matchedItems, 3) * 0.03;

  return {
    fanInteractionBonus: fanBonus,
    merchSalesBonus: merchBonus,
    matchedItems,
  };
}
