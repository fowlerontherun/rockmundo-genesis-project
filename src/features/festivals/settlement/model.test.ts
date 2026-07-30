import { describe,expect,it } from "vitest";
import { aggregateCash,parsePostingResult,parseReadiness,publicError,redactHistory,weightedSatisfaction,type SettlementLine } from "./model";
const line=(line_kind:"revenue"|"cost",cash_state:SettlementLine["cash_state"],net_amount_minor:number):SettlementLine=>({id:crypto.randomUUID(),line_kind,cash_state,net_amount_minor,category:"test",currency_code:"GBP",source_type:"test"});
describe("settlement domain",()=>{
 it("derives cash and outstanding totals from persisted line states",()=>expect(aggregateCash([line("revenue","received",500),line("cost","paid",200),line("revenue","receivable",300),line("cost","payable",100)])).toEqual({postedRevenueMinor:500,postedCostsMinor:200,postedNetMinor:300,outstandingReceivablesMinor:300,outstandingPayablesMinor:100}));
 it("calculates typed weighted satisfaction",()=>expect(weightedSatisfaction({sound:100,safety:50},{sound:1,safety:3})).toBe(62.5));
 it("redacts private history",()=>expect(redactHistory({editionId:"e",lineup:["b"],contracts:["secret"],medical:{secret:true}})).toEqual({editionId:"e",lineup:["b"]}));
 it("validates readiness and posting responses",()=>{expect(parseReadiness({runtimeState:"completed",runtimeId:"r",runtimeDigest:"d",settlementExists:false,eligible:true,blockers:[]})).toMatchObject({eligible:true});expect(()=>parsePostingResult({state:"posting"})).toThrow(/settlementId/)});
 it("maps stable errors without leaking SQL",()=>{expect(publicError(new Error("FESTIVAL_SETTLEMENT_INSUFFICIENT_FUNDS: balance"))).toMatch(/remains payable/);expect(publicError(new Error("syntax error at SQL"))).not.toContain("SQL")});
});
