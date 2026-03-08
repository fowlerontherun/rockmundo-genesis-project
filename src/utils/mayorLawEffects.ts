/**
 * Mayor law mechanical effects system.
 * City laws enacted by the mayor have tangible gameplay impacts on residents.
 */

import type { CityLaws } from "@/types/city-governance";

export interface LawEffects {
  /** Multiplier on all player income in this city (after tax) */
  incomeMultiplier: number;
  /** Multiplier on purchase prices (sales tax) */
  purchaseCostMultiplier: number;
  /** Flat fee to travel out of city */
  travelTax: number;
  /** Fee to busk in this city */
  buskingFee: number;
  /** Fee to book a venue */
  venuePermitCost: number;
  /** Genres that get a fame bonus in this city */
  promotedGenres: string[];
  /** Genres banned from performing */
  prohibitedGenres: string[];
  /** Max concert size (null = unlimited) */
  maxConcertCapacity: number | null;
  /** Noise curfew hour (24h format, null = none) */
  noiseCurfewHour: number | null;
  /** Whether festivals require permits */
  festivalPermitRequired: boolean;
  /** Bonus multiplier for promoted genre gigs */
  promotedGenreBonus: number;
}

/**
 * Calculate gameplay effects from city laws.
 */
export function calculateLawEffects(laws: CityLaws | null): LawEffects {
  if (!laws) {
    return {
      incomeMultiplier: 1,
      purchaseCostMultiplier: 1,
      travelTax: 0,
      buskingFee: 0,
      venuePermitCost: 0,
      promotedGenres: [],
      prohibitedGenres: [],
      maxConcertCapacity: null,
      noiseCurfewHour: null,
      festivalPermitRequired: false,
      promotedGenreBonus: 1,
    };
  }

  // Income tax: 0-50% → multiplier 1.0-0.5
  const incomeMultiplier = Math.max(0.5, 1 - (laws.income_tax_rate || 0) / 100);

  // Sales tax: 0-25% → cost multiplier 1.0-1.25
  const purchaseCostMultiplier = 1 + (laws.sales_tax_rate || 0) / 100;

  // Promoted genres get +15% fame from gigs
  const promotedGenreBonus = 1.15;

  return {
    incomeMultiplier,
    purchaseCostMultiplier,
    travelTax: laws.travel_tax || 0,
    buskingFee: laws.busking_license_fee || 0,
    venuePermitCost: laws.venue_permit_cost || 0,
    promotedGenres: laws.promoted_genres || [],
    prohibitedGenres: laws.prohibited_genres || [],
    maxConcertCapacity: laws.max_concert_capacity,
    noiseCurfewHour: laws.noise_curfew_hour,
    festivalPermitRequired: laws.festival_permit_required || false,
    promotedGenreBonus,
  };
}

/**
 * Check if a genre is banned in the city.
 */
export function isGenreBanned(genre: string, laws: CityLaws | null): boolean {
  if (!laws?.prohibited_genres?.length) return false;
  return laws.prohibited_genres.some(
    g => g.toLowerCase() === genre.toLowerCase()
  );
}

/**
 * Check if a genre is promoted in the city.
 */
export function isGenrePromoted(genre: string, laws: CityLaws | null): boolean {
  if (!laws?.promoted_genres?.length) return false;
  return laws.promoted_genres.some(
    g => g.toLowerCase() === genre.toLowerCase()
  );
}

/**
 * Apply income tax to an earning amount.
 */
export function applyIncomeTax(amount: number, laws: CityLaws | null): { net: number; taxPaid: number } {
  const rate = laws?.income_tax_rate || 0;
  const taxPaid = Math.round(amount * rate / 100);
  return { net: amount - taxPaid, taxPaid };
}
