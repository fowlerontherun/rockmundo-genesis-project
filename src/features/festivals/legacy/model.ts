import type { FestivalLegacyFilter, FestivalResult } from "./types";

export const matchesFestivalLegacyFilter = (result: FestivalResult, filter: FestivalLegacyFilter) =>
  (!filter.year || result.editionYear === filter.year) &&
  (!filter.country || result.country === filter.country) &&
  (!filter.city || result.city === filter.city) &&
  (!filter.festivalType || result.festivalType === filter.festivalType) &&
  (!filter.genre || result.genres.includes(filter.genre));

export const summariseFestivalResults = (results: FestivalResult[]) => ({
  editions: results.length,
  attendance: results.reduce((sum, item) => sum + item.attendance, 0),
  revenueMinor: results.reduce((sum, item) => sum + item.revenueMinor, 0),
  profitLossMinor: results.reduce((sum, item) => sum + item.profitLossMinor, 0),
  averageRating: results.length ? results.reduce((sum, item) => sum + item.overallRating, 0) / results.length : 0,
  sellOuts: results.filter((item) => item.soldOut).length,
});
