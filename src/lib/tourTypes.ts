// Tour system types and constants

export type TourScope = 'country' | 'continent' | 'world';
export type TravelMode = 'manual' | 'auto' | 'tour_bus';
export type StageSetupTier = 'basic' | 'enhanced' | 'professional' | 'premium' | 'spectacular';

export const STAGE_SETUP_TIERS = {
  basic: { 
    label: 'Basic', 
    costPerShow: 0, 
    description: 'Standard venue equipment only',
    merchBoost: 1.0,
    fameBoost: 1.0,
    minFame: 0,
  },
  enhanced: { 
    label: 'Enhanced', 
    costPerShow: 500, 
    description: 'Additional lighting + backdrop',
    merchBoost: 1.1,
    fameBoost: 1.05,
    minFame: 0,
  },
  professional: { 
    label: 'Professional', 
    costPerShow: 2000, 
    description: 'Full light show + video screens',
    merchBoost: 1.25,
    fameBoost: 1.15,
    minFame: 2000,
  },
  premium: { 
    label: 'Premium', 
    costPerShow: 5000, 
    description: 'Pyrotechnics + custom stage design',
    merchBoost: 1.5,
    fameBoost: 1.3,
    minFame: 10000,
  },
  spectacular: { 
    label: 'Spectacular', 
    costPerShow: 15000, 
    description: 'Arena-level production with all effects',
    merchBoost: 2.0,
    fameBoost: 1.5,
    minFame: 50000,
  },
} as const;

export interface TourWizardState {
  // Step 1: Basics
  name: string;
  startingCityId: string | null;
  startDate: string;
  durationDays: number | null;
  targetShowCount: number | null;
  minRestDays: number;
  setlistId: string | null;
  
  // Step 2: Scope
  scope: TourScope;
  
  // Step 3: Countries/Regions
  selectedCountries: string[];
  selectedContinents: string[];
  
  // Step 4: Venues
  venueTypes: string[];
  maxVenueCapacity: number;
  selectedVenueIds: string[];
  venueGenreFilter: string | null;
  venueCityFilter: string | null;
  venueCountryFilter: string | null;
  
  // Step 5: Ticket Pricing
  customTicketPrice: number | null;
  
  // Step 6: Stage Setup
  stageSetupTier: StageSetupTier;
  
  // Step 7: Travel (tour bus cost now static)
  travelMode: TravelMode;
  tourBusDailyCost: number;
  
  // Step 8: Support Artist
  supportBandId: string | null;
  supportBandName: string | null;
  supportRevenueShare: number;
  
  // Step 9: Sponsorship
  selectedSponsorOfferId: string | null;
  sponsorName: string | null;
  sponsorCashValue: number;
  sponsorTicketPenalty: number;
  sponsorFamePenalty: number;
  
  // Calculated
  bandId: string | null;
}

export const TOUR_SCOPE_REQUIREMENTS = {
  country: { fame: 0, label: 'Country Tour', description: 'Tour within a single country' },
  continent: { fame: 5000, label: 'Continental Tour', description: 'Tour across multiple countries in a region' },
  world: { fame: 25000, label: 'World Tour', description: 'Tour across multiple continents' },
} as const;

export const VENUE_SIZE_REQUIREMENTS = {
  small: { maxCapacity: 500, minFans: 0, label: 'Small Venues', description: 'Clubs & bars (≤500)' },
  medium: { maxCapacity: 2000, minFans: 1000, label: 'Medium Venues', description: 'Theaters & halls (≤2000)' },
  large: { maxCapacity: 10000, minFans: 10000, label: 'Large Venues', description: 'Arenas (≤10,000)' },
  arena: { maxCapacity: 50000, minFans: 50000, label: 'Arenas', description: 'Major arenas (≤50,000)' },
  stadium: { maxCapacity: 999999, minFans: 250000, label: 'Stadiums', description: 'Stadiums (50,000+)' },
} as const;

export const VENUE_TYPES = [
  'club', 'bar', 'theater', 'concert_hall', 'arena', 'stadium', 'festival_ground', 'outdoor'
] as const;

export const CONTINENTS = [
  'Europe', 'North America', 'South America', 'Asia', 'Oceania', 'Africa'
] as const;

export const CANCELLATION_REFUND_SCALE = [
  { daysBeforeStart: 30, refundPercent: 90 },
  { daysBeforeStart: 14, refundPercent: 70 },
  { daysBeforeStart: 7, refundPercent: 50 },
  { daysBeforeStart: 1, refundPercent: 25 },
  { daysBeforeStart: 0, refundPercent: 0 },
] as const;

export const TOUR_BUS_DAILY_COST = 150; // Static daily rental cost

export const TOUR_MERCH_BOOST = 1.3; // Tours get 30% boost on merch sales

export const DEFAULT_WIZARD_STATE: TourWizardState = {
  name: '',
  startingCityId: null,
  startDate: '',
  durationDays: 30,
  targetShowCount: null,
  minRestDays: 1,
  setlistId: null,
  scope: 'country',
  selectedCountries: [],
  selectedContinents: [],
  venueTypes: ['club', 'bar', 'theater'],
  maxVenueCapacity: 500,
  selectedVenueIds: [],
  venueGenreFilter: null,
  venueCityFilter: null,
  venueCountryFilter: null,
  customTicketPrice: null,
  stageSetupTier: 'basic',
  travelMode: 'auto',
  tourBusDailyCost: TOUR_BUS_DAILY_COST,
  supportBandId: null,
  supportBandName: null,
  supportRevenueShare: 0.1,
  selectedSponsorOfferId: null,
  sponsorName: null,
  sponsorCashValue: 0,
  sponsorTicketPenalty: 0,
  sponsorFamePenalty: 0,
  bandId: null,
};

export interface TourCostEstimate {
  venueCosts: number;
  bookingFees: number;
  travelCosts: number;
  tourBusCosts: number;
  stageSetupCosts: number;
  totalUpfrontCost: number;
  sponsorCashIncome: number;
  netUpfrontCost: number;
  estimatedTicketRevenue: number;
  estimatedMerchRevenue: number;
  supportArtistShare: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  showCount: number;
}

export interface VenueMatch {
  venueId: string;
  venueName: string;
  cityId: string;
  cityName: string;
  country: string;
  capacity: number;
  venueType: string;
  basePayment: number;
  bookingFee: number;
  estimatedTicketRevenue: number;
  date: string;
  genre?: string;
}

// Support artist split calculation based on fame ratio
export function calculateSupportArtistSplit(
  headlinerFame: number,
  supportFame: number
): { headlinerPercent: number; supportPercent: number } {
  const fameRatio = headlinerFame / Math.max(supportFame, 1);
  
  if (fameRatio > 10) return { headlinerPercent: 90, supportPercent: 10 };
  if (fameRatio > 5) return { headlinerPercent: 85, supportPercent: 15 };
  if (fameRatio > 2) return { headlinerPercent: 80, supportPercent: 20 };
  return { headlinerPercent: 75, supportPercent: 25 };
}
