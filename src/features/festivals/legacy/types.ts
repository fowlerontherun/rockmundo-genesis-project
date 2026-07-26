export type FestivalLegacyFilter = { year?: number; country?: string; city?: string; festivalType?: string; genre?: string; limit?: number; offset?: number };
export type MoneyMinor = string;
export type FestivalResult = {
  id:string; festivalEditionId:string; festivalName:string; editionYear:number; country:string; city:string; festivalType:string; genres:string[];
  attendance:number; peakAttendance:number; siteCapacity:number; sellOutPercentage:number; fastestSellOutSeconds?:number;
  revenueMinor:MoneyMinor; profitLossMinor:MoneyMinor; currencyCode:string; soldOut:boolean; crowdSatisfaction:number; overallRating:number;
  weatherSummary:unknown; incidentSummary:Record<string,number>; performanceCount:number; largestPerformanceCrowd:number;
  performanceHighlights:unknown[]; sponsorSummary:unknown; merchandiseSummary:unknown; foodDrinkSummary:unknown; headliners:unknown[]; posterUrl?:string; publishedAt:string;
};
export type FestivalAward={id:string;seasonYear:number;category:string;winnerType:string;winnerId:string;winnerName:string;festivalResultId:string;score:number;citation:string};
export type FestivalRecord={id:string;category:string;holderName:string;festivalResultId:string;value:number;unit:string;achievedYear:number;evidence:unknown};
export type FestivalResultPage={items:FestivalResult[];limit:number;offset:number};
export type FestivalResultDetail=FestivalResult&{review:Record<string,unknown>;lineUp:unknown[];timetable:unknown[];awards:FestivalAward[];recordsHeld:FestivalRecord[];publicationStories:unknown[]};
export type CurrencyTotal={currencyCode:string;revenueMinor:MoneyMinor;profitLossMinor:MoneyMinor};
export type FestivalStatistics={editions:number;attendance:number;averageRating:number;sellOuts:number;moneyByCurrency:CurrencyTotal[];groups:Array<{label:string;editions:number;attendance:number;averageRating:number;moneyByCurrency:CurrencyTotal[]}>};
export type FestivalHallOfFameEntry=FestivalResult&{rank:number;legacyScore:number;formulaVersion:string};
