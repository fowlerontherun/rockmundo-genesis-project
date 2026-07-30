export type CashState = "due" | "received" | "paid" | "receivable" | "payable" | "already_posted" | "not_applicable" | "written_off" | "cancelled";

export interface SettlementReadiness {
  runtimeState: string;
  runtimeId: string | null;
  runtimeDigest: string | null;
  settlementExists: boolean;
  eligible: boolean;
  blockers: string[];
}

export interface SettlementLine {
  id: string; line_kind: "revenue" | "cost"; category: string;
  net_amount_minor: number; currency_code: string; cash_state: CashState; source_type: string;
}
export interface SettlementAggregate {
  id: string; state: string; settlement_version: number; currency_code: string;
  gross_revenue_minor: number; total_costs_minor: number; tax_minor: number; refunds_minor: number;
  net_profit_loss_minor: number; cash_posted_minor: number; amount_posted_to_company_minor: number;
  unpaid_receivables_minor: number; unpaid_payables_minor: number; reconciliation_status: string;
}
export interface PostingBatch { id:string; state:string; completed_items:number; expected_items:number; pending_items:number; failed_items:number; failure?:{code?:string;lineId?:string}; }
export interface SettlementReport { settlement:SettlementAggregate; lines:SettlementLine[]; outcomes:Array<{outcome_type:string;subject_id:string;final_score:number|null;effects?:Record<string,unknown>}>; batch:PostingBatch|null; audit:Array<{id:string;action:string;status:string;created_at:string}>; }
export interface PostingResult { state:string; settlementId:string; postingBatchId:string; completedItems:number; expectedItems:number; pendingItems:number; failedItems:number; failedLineId?:string; errorCode?:string; }

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label} response`);
  return value as Record<string, unknown>;
};
const string = (o:Record<string,unknown>, key:string, nullable=false) => {
  const value=o[key]; if(nullable&&value===null)return null; if(typeof value!=="string")throw new Error(`Invalid response field: ${key}`); return value;
};
const number = (o:Record<string,unknown>, key:string) => { const value=o[key]; if(typeof value!=="number")throw new Error(`Invalid response field: ${key}`); return value; };

export function parseReadiness(value:unknown):SettlementReadiness { const o=object(value,"readiness"); const blockers=o.blockers; if(!Array.isArray(blockers)||!blockers.every(x=>typeof x==="string"))throw new Error("Invalid response field: blockers"); return {runtimeState:string(o,"runtimeState"),runtimeId:string(o,"runtimeId",true),runtimeDigest:string(o,"runtimeDigest",true),settlementExists:Boolean(o.settlementExists),eligible:Boolean(o.eligible),blockers}; }
export function parsePostingResult(value:unknown):PostingResult { const o=object(value,"posting"); return {state:string(o,"state"),settlementId:string(o,"settlementId"),postingBatchId:string(o,"postingBatchId"),completedItems:number(o,"completedItems"),expectedItems:number(o,"expectedItems"),pendingItems:number(o,"pendingItems"),failedItems:number(o,"failedItems"),...(typeof o.failedLineId==="string"?{failedLineId:o.failedLineId}:{}),...(typeof o.errorCode==="string"?{errorCode:o.errorCode}:{})}; }

export const settlementErrorMessages:Record<string,string>={
 FESTIVAL_SETTLEMENT_RECIPIENT_INVALID:"A payment recipient no longer matches its authoritative contract.", FESTIVAL_SETTLEMENT_CONTRACT_MISMATCH:"A financial line does not match its contract.", FESTIVAL_SETTLEMENT_SOURCE_ALREADY_CONSUMED:"That financial source has already been settled.", FESTIVAL_SETTLEMENT_INSUFFICIENT_FUNDS:"Company cash is insufficient; the obligation remains payable.", FESTIVAL_SETTLEMENT_RECEIVABLE_NOT_DUE:"This receivable is not currently due.", FESTIVAL_SETTLEMENT_PAYABLE_NOT_DUE:"This payable is not currently due.", FESTIVAL_SETTLEMENT_POSTING_ITEM_FAILED:"One ledger movement failed. Earlier movements are safe; retry the failed item.", FESTIVAL_SETTLEMENT_OUTCOME_APPLICATION_FAILED:"Festival outcomes could not be applied safely.", FESTIVAL_SETTLEMENT_ACHIEVEMENT_FAILED:"An achievement could not be awarded.", FESTIVAL_SETTLEMENT_HISTORY_INCOMPLETE:"The permanent Festival history is incomplete.",
};
export function publicError(error:unknown){const raw=error instanceof Error?error.message:String(error);const code=Object.keys(settlementErrorMessages).find(k=>raw.includes(k));return code?settlementErrorMessages[code]:"The authoritative settlement operation failed. Please retry or contact support with the audit reference.";}

export function aggregateCash(lines:SettlementLine[]){return lines.reduce((a,line)=>{if(line.cash_state==="received")a.postedRevenueMinor+=line.line_kind==="revenue"?line.net_amount_minor:0;if(line.cash_state==="paid")a.postedCostsMinor+=line.line_kind==="cost"?line.net_amount_minor:0;if(line.cash_state==="receivable")a.outstandingReceivablesMinor+=line.net_amount_minor;if(line.cash_state==="payable")a.outstandingPayablesMinor+=line.net_amount_minor;a.postedNetMinor=a.postedRevenueMinor-a.postedCostsMinor;return a},{postedRevenueMinor:0,postedCostsMinor:0,postedNetMinor:0,outstandingReceivablesMinor:0,outstandingPayablesMinor:0});}

export function weightedSatisfaction(components:Record<string,number>,weights:Record<string,number>){let score=0,total=0;for(const [key,weight] of Object.entries(weights)){const value=components[key];if(Number.isFinite(value)&&weight>0){score+=Math.max(0,Math.min(100,value))*weight;total+=weight;}}return total===0?null:Math.round((score/total)*100)/100;}

export function redactHistory(snapshot:Record<string,unknown>){const {private_snapshot:_,financialLines:__,contracts:___,paymentReferences:____,medical:_____,security:______,...publicFields}=snapshot;return publicFields;}
