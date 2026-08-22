import { supabase } from "@/integrations/supabase/client";
import { parseEffectProgress, parseFinalisation, parsePostingResult, parsePublicHistory, parseReadiness, type EffectProgress, type FinalisationResult, type PostingResult, type SettlementReadiness, type SettlementReport } from "./model";
import { parseSimplifiedFestivalResults, type SimplifiedFestivalResults } from "./simplifiedResults";

type RpcClient={rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:{message:string}|null}>};
const rpcClient:RpcClient=supabase as unknown as RpcClient;
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await rpcClient.rpc(name,args);if(error)throw new Error(error.message);return data;}
export const settlementRepository={
 readiness:async(companyId:string,editionId:string):Promise<SettlementReadiness>=>parseReadiness(await rpc("get_festival_edition_settlement_readiness",{p_festival_company_id:companyId,p_edition_id:editionId})),
 read:async(companyId:string,editionId:string)=>await rpc("get_festival_edition_settlement",{p_festival_company_id:companyId,p_edition_id:editionId}) as SettlementReport|null,
 prepare:(editionId:string,digest:string,key:string)=>rpc("prepare_festival_edition_settlement",{p_edition_id:editionId,p_expected_runtime_digest:digest,p_idempotency_key:key}),
 approve:(id:string,version:number,key:string)=>rpc("approve_festival_edition_settlement",{p_settlement_id:id,p_expected_version:version,p_idempotency_key:key}),
 startPosting:async(id:string,version:number,key:string):Promise<PostingResult>=>parsePostingResult(await rpc("start_festival_edition_settlement_posting",{p_settlement_id:id,p_expected_version:version,p_idempotency_key:key})),
 postNext:async(id:string,key:string):Promise<PostingResult>=>parsePostingResult(await rpc("post_next_festival_edition_settlement_item",{p_settlement_id:id,p_idempotency_key:key})),
 finalisePosting:async(id:string,key:string):Promise<PostingResult>=>parsePostingResult(await rpc("finalise_festival_edition_settlement_posting",{p_settlement_id:id,p_idempotency_key:key})),
 applyOutcomes:(id:string,version:number,key:string)=>rpc("apply_festival_edition_outcomes",{p_settlement_id:id,p_expected_version:version,p_idempotency_key:key}),
 effectProgress:async(id:string):Promise<EffectProgress>=>parseEffectProgress(await rpc("get_festival_settlement_effect_progress",{p_settlement_id:id})),
 resumeEffects:(id:string,reason:string)=>rpc("resume_festival_settlement_effects",{p_settlement_id:id,p_effect_ids:null,p_reason:reason}),
 finalise:async(id:string,version:number,key:string):Promise<FinalisationResult>=>parseFinalisation(await rpc("finalise_festival_edition_settlement",{p_settlement_id:id,p_expected_version:version,p_idempotency_key:key})),
 receiveReceivable:(lineId:string,key:string)=>rpc("receive_festival_settlement_receivable",{p_line_id:lineId,p_idempotency_key:key}),
 payPayable:(lineId:string,key:string)=>rpc("pay_festival_settlement_payable",{p_line_id:lineId,p_idempotency_key:key}),
 writeOffReceivable:(lineId:string,key:string)=>rpc("write_off_festival_settlement_receivable",{p_line_id:lineId,p_idempotency_key:key}),
 cancelPayable:(lineId:string,key:string)=>rpc("cancel_festival_settlement_payable",{p_line_id:lineId,p_idempotency_key:key}),
 outcomes:(companyId:string,editionId:string)=>settlementRepository.read(companyId,editionId).then(x=>x?.outcomes??[]),
 ownerHistory:async(companyId:string,editionId:string):Promise<SimplifiedFestivalResults|null>=>parseSimplifiedFestivalResults(await rpc("get_festival_edition_results",{p_festival_company_id:companyId,p_edition_id:editionId})),
 history:async(editionId:string)=>parsePublicHistory(await rpc("get_public_festival_edition_history",{p_edition_id:editionId})),
};
