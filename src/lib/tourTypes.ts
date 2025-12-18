// Tour system types and constants

export type TourScope = 'country' | 'continent' | 'world';
export type TravelMode = 'manual' | 'auto' | 'tour_bus';

export interface TourWizardState {
  // Step 1: Basics
  name: string;
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
  
  // Step 5: Travel
  travelMode: TravelMode;
  tourBusDailyCost: number;
  
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

export const TOUR_BUS_DAILY_COST = 500; // Default daily rental

export const DEFAULT_WIZARD_STATE: TourWizardState = {
  name: '',
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
  travelMode: 'auto',
  tourBusDailyCost: TOUR_BUS_DAILY_COST,
  bandId: null,
};

export interface TourCostEstimate {
  venueCosts: number;
  bookingFees: number;
  travelCosts: number;
  tourBusCosts: number;
  totalUpfrontCost: number;
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
}
