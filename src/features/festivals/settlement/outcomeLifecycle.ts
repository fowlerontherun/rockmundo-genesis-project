export const FESTIVAL_OUTCOME_RULES_VERSION = "festival-outcomes-v2";

export type EvidenceValue = { source: string; raw: number | null; normalised?: number; weight: number; missing?: "redistribute" | "not_applicable" };
export type WeightedEvidence = EvidenceValue & { available: boolean; normalised: number | null; effectiveWeight: number; weightedContribution: number };
export type WeightedOutcome = { score: number | null; components: Record<string, WeightedEvidence>; rulesVersion: string; missingEvidenceHandling: "redistribute_available_weights" };
const clamp = (value:number) => Math.max(0, Math.min(100, value));

/** Missing evidence is explicit and its weight is redistributed; no hidden neutral score is introduced. */
export function calculateEvidenceOutcome(input: Record<string, EvidenceValue>): WeightedOutcome {
  const availableWeight = Object.values(input).reduce((sum, item) => sum + (Number.isFinite(item.raw) && item.weight > 0 ? item.weight : 0), 0);
  const components: Record<string, WeightedEvidence> = {};
  let score = 0;
  for (const [key, item] of Object.entries(input)) {
    const available = Number.isFinite(item.raw) && item.weight > 0;
    const normalised = available ? clamp(item.normalised ?? item.raw!) : null;
    const effectiveWeight = availableWeight ? (available ? item.weight / availableWeight : 0) : 0;
    const weightedContribution = normalised === null ? 0 : normalised * effectiveWeight;
    score += weightedContribution;
    components[key] = {...item, available, normalised, effectiveWeight, weightedContribution, missing: available ? item.missing : "redistribute"};
  }
  return {score: availableWeight ? Math.round(score * 100) / 100 : null, components, rulesVersion:FESTIVAL_OUTCOME_RULES_VERSION, missingEvidenceHandling:"redistribute_available_weights"};
}

export type EffectStatus = "pending"|"applying"|"applied"|"not_applicable"|"failed"|"recovery_required";
const transitions:Record<EffectStatus,readonly EffectStatus[]>={pending:["applying","not_applicable"],applying:["applied","failed","recovery_required"],failed:["pending","recovery_required"],recovery_required:["pending"],applied:[],not_applicable:[]};
export function transitionEffect(current:EffectStatus,next:EffectStatus){if(!transitions[current].includes(next))throw new Error(`Invalid Festival effect transition: ${current} -> ${next}`);return next;}
export function outcomeAppliedAt(statuses:EffectStatus[],now:string):string|null{return statuses.length>0&&statuses.every(s=>s==="applied"||s==="not_applicable")?now:null;}

export function performanceEffectReference(sessionId:string,effectType:string,subjectId:string){if(!sessionId||!effectType||!subjectId)throw new Error("Festival effect identity is incomplete");return `festival-performance:${sessionId}:${effectType}:${subjectId}`;}
export function resolveArtistIdentity(contract:{performer_type?:unknown;performer_id?:unknown},session?:{band_id?:unknown;artist_id?:unknown}){
 const type=contract.performer_type==="band"?"band":contract.performer_type==="solo_artist"?"solo_artist":null;
 const id=typeof contract.performer_id==="string"?contract.performer_id:type==="band"&&typeof session?.band_id==="string"?session.band_id:type==="solo_artist"&&typeof session?.artist_id==="string"?session.artist_id:null;
 if(!type||!id)return null; return {subjectType:type,subjectId:id};
}
export const FESTIVAL_ACHIEVEMENTS = new Set(["festival.found_company","festival.run_first","festival.profitable","festival.sell_out","festival.safe_event","festival.multi_day","festival.major","festival.max_upgrades","festival.five_editions","festival.ten_editions"]);
export function mapAchievement(key:string){return FESTIVAL_ACHIEVEMENTS.has(key)?key:null;}
export function licenceProgress(requirements:Record<string,boolean>){const entries=Object.entries(requirements),met=entries.filter(([,v])=>v).map(([k])=>k),missing=entries.filter(([,v])=>!v).map(([k])=>k);return {requirementsMet:met,requirementsMissing:missing,percentageProgress:entries.length?Math.round(met.length/entries.length*100):0,applicationEligible:entries.length>0&&missing.length===0};}
export function appliedHistory(effects:Array<{stableReference:string;status:EffectStatus;appliedResult?:unknown;canonicalId?:string}>){return effects.filter(e=>e.status==="applied"||e.status==="not_applicable").map(({stableReference,status,appliedResult,canonicalId})=>({stableReference,status,appliedResult:status==="applied"?appliedResult:undefined,canonicalId}));}
