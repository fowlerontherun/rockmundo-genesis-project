export type FestivalLegacyFilter = {
  year?: number;
  country?: string;
  city?: string;
  festivalType?: string;
  genre?: string;
  limit?: number;
  offset?: number;
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
  siteCapacity: number;
  sellOutPercentage: number;
  fastestSellOutSeconds?: number;
  revenueMinor: number;
  profitLossMinor: number;
  currencyCode: string;
  soldOut: boolean;
  crowdSatisfaction: number;
  overallRating: number;
  weatherSummary: unknown[];
  incidentSummary: Record<string, number>;
  performanceCount: number;
  largestPerformanceCrowd: number;
  performanceHighlights: unknown[];
  headlinerPerformance: Record<string, unknown>;
  sponsorSummary: Record<string, unknown>;
  merchandiseSummary: Record<string, unknown>;
  foodDrinkSummary: Record<string, unknown>;
  headliners: string[];
  posterUrl?: string;
  publishedAt: string;
};

export type FestivalResultPage = { items: FestivalResult[]; limit: number; offset: number };
export type FestivalResultDetail = FestivalResult & { review: Record<string, unknown>; lineUp: unknown[]; timetable: unknown[]; awards: FestivalAward[]; recordsHeld: FestivalRecord[]; publicationStories: unknown[] };

export type FestivalAward = { id: string; seasonYear: number; category: string; winnerName: string; festivalResultId?: string; score: number; citation: string };
export type FestivalRecord = { id: string; category: string; holderName: string; value: number; unit: string; achievedYear: number };
export type FestivalStatistics = { editions: number; attendance: number; revenueMinor: number; profitLossMinor: number; averageRating: number; sellOuts: number; groups: Array<{label:string;editions:number;attendance:number;averageRating:number;profitLossMinor:number}> };
