import type { FestivalLegacyFilter, FestivalResult } from "./types";
export const matchesFestivalLegacyFilter=(r:FestivalResult,f:FestivalLegacyFilter)=>(!f.year||r.editionYear===f.year)&&(!f.country||r.country===f.country)&&(!f.city||r.city===f.city)&&(!f.festivalType||r.festivalType===f.festivalType)&&(!f.genre||r.genres.includes(f.genre));
export const summariseFestivalResults=(results:FestivalResult[])=>({editions:results.length,attendance:results.reduce((s,r)=>s+r.attendance,0),moneyByCurrency:Object.values(results.reduce<Record<string,{currencyCode:string;revenueMinor:string;profitLossMinor:string}>>((all,r)=>{const prior=all[r.currencyCode]??{currencyCode:r.currencyCode,revenueMinor:"0",profitLossMinor:"0"};all[r.currencyCode]={...prior,revenueMinor:(BigInt(prior.revenueMinor)+BigInt(r.revenueMinor)).toString(),profitLossMinor:(BigInt(prior.profitLossMinor)+BigInt(r.profitLossMinor)).toString()};return all},{})),averageRating:results.length?results.reduce((s,r)=>s+r.overallRating,0)/results.length:0,sellOuts:results.filter(r=>r.soldOut).length});
export const formatMinorMoney=(minor:string,currencyCode:string)=>{
  const value=BigInt(minor);
  const formatter=new Intl.NumberFormat("en-GB",{style:"currency",currency:currencyCode});
  const digits=formatter.resolvedOptions().maximumFractionDigits;
  const scale=10n**BigInt(digits);
  const absolute=value<0n?-value:value;
  const parts=formatter.formatToParts(absolute/scale).map(part=>part.type==="fraction"?{...part,value:(absolute%scale).toString().padStart(digits,"0")}:part);
  return `${value<0n?"-":""}${parts.map(part=>part.value).join("")}`;
};
