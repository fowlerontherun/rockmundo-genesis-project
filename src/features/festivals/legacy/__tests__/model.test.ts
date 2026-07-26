import { describe, expect, it } from "vitest";
import { formatMinorMoney, matchesFestivalLegacyFilter, summariseFestivalResults } from "../model";
import type { FestivalResult } from "../types";

const result = { id:"1", festivalEditionId:"e", festivalName:"Pulse", editionYear:2026, country:"UK", city:"London", festivalType:"major", genres:["rock"], attendance:100, peakAttendance:90, siteCapacity:100, sellOutPercentage:100, performanceCount:1, largestPerformanceCrowd:90, revenueMinor:"1000", profitLossMinor:"250", currencyCode:"GBP", soldOut:true, crowdSatisfaction:88, overallRating:91, weatherSummary:"Clear", incidentSummary:{}, performanceHighlights:[], sponsorSummary:{}, merchandiseSummary:{}, foodDrinkSummary:{}, headliners:[], publishedAt:"2026-01-01" } satisfies FestivalResult;
describe("festival legacy model", () => {
  it("formats signed and small integer minor units without precision loss",()=>{expect(formatMinorMoney("123456","GBP")).toBe("£1,234.56");expect(formatMinorMoney("-123456","GBP")).toBe("-£1,234.56");expect(formatMinorMoney("0","GBP")).toBe("£0.00");expect(formatMinorMoney("99","GBP")).toBe("£0.99");expect(formatMinorMoney("1234","JPY")).toBe("￥1,234");expect(formatMinorMoney("1234","KWD")).toBe("KWD 1.234")});
  it("applies every public archive filter", () => expect(matchesFestivalLegacyFilter(result, {year:2026,country:"UK",city:"London",festivalType:"major",genre:"rock"})).toBe(true));
  it("rejects a mismatched filter", () => expect(matchesFestivalLegacyFilter(result, {genre:"jazz"})).toBe(false));
  it("aggregates immutable result statistics", () => expect(summariseFestivalResults([result, {...result,id:"2",attendance:50,soldOut:false}])).toMatchObject({editions:2,attendance:150,moneyByCurrency:[{currencyCode:"GBP",revenueMinor:"2000",profitLossMinor:"500"}],averageRating:91,sellOuts:1}));
});
