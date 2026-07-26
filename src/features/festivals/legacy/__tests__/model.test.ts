import { describe, expect, it } from "vitest";
import { matchesFestivalLegacyFilter, summariseFestivalResults } from "../model";
import type { FestivalResult } from "../types";

const result = { id:"1", festivalEditionId:"e", festivalName:"Pulse", editionYear:2026, country:"UK", city:"London", festivalType:"major", genres:["rock"], attendance:100, peakAttendance:90, revenueMinor:1000, profitLossMinor:250, currencyCode:"GBP", soldOut:true, crowdSatisfaction:88, overallRating:91, weatherSummary:"Clear", incidentSummary:"None", performanceHighlights:[], headlinerPerformance:{}, sponsorSummary:{}, merchandiseSummary:{}, foodDrinkSummary:{}, headliners:[], publishedAt:"2026-01-01" } satisfies FestivalResult;
describe("festival legacy model", () => {
  it("applies every public archive filter", () => expect(matchesFestivalLegacyFilter(result, {year:2026,country:"UK",city:"London",festivalType:"major",genre:"rock"})).toBe(true));
  it("rejects a mismatched filter", () => expect(matchesFestivalLegacyFilter(result, {genre:"jazz"})).toBe(false));
  it("aggregates immutable result statistics", () => expect(summariseFestivalResults([result, {...result,id:"2",attendance:50,soldOut:false}])).toMatchObject({editions:2,attendance:150,profitLossMinor:500,averageRating:91,sellOuts:1}));
});
