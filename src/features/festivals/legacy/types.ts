export type FestivalLegacyFilter = {
  year?: number;
  country?: string;
  city?: string;
  festivalType?: string;
  genre?: string;
};

export type FestivalResult = {
  id: string;
  festivalEditionId: string;
  festivalName: string;
  editionYear: number;
  country: string;
  city: string;
  festivalType: string;
  genres: string[];
  attendance: number;
  peakAttendance: number;
  revenueMinor: number;
  profitLossMinor: number;
  currencyCode: string;
  soldOut: boolean;
  crowdSatisfaction: number;
  overallRating: number;
  weatherSummary: string;
  incidentSummary: string;
  performanceHighlights: unknown[];
  headlinerPerformance: Record<string, unknown>;
  sponsorSummary: Record<string, unknown>;
  merchandiseSummary: Record<string, unknown>;
  foodDrinkSummary: Record<string, unknown>;
  headliners: string[];
  posterUrl?: string;
  publishedAt: string;
};

export type FestivalAward = { id: string; seasonYear: number; category: string; winnerName: string; festivalResultId?: string; score: number; citation: string };
export type FestivalRecord = { id: string; category: string; holderName: string; value: number; unit: string; achievedYear: number };
export type FestivalStatistics = { editions: number; attendance: number; revenueMinor: number; profitLossMinor: number; averageRating: number; sellOuts: number };
