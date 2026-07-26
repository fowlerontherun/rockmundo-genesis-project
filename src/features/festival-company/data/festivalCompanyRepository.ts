import { supabase } from "@/integrations/supabase/client";
import type { FoundFestivalCompanyInput, FoundFestivalCompanyResult } from "../domain/festivalCompany";
import type { FestivalCompanySetupState } from "../domain/festivalSetup";
import { disabledFestivalCompanyCapabilities, type FestivalCompanyCapabilities } from "../domain/festivalCapabilities";
import { disabledFestivalCompanyEligibility, parseFestivalCompanyEligibility, type FestivalCompanyFoundingEligibility } from "../domain/festivalEligibility";
import { parseFestivalConfiguration, type FestivalConfiguration, type FestivalConfigurationDraft } from "../domain/festivalConfiguration";
import { normalizeFestivalConfigurationError } from "../domain/festivalConfigurationErrors";
import { parseFestivalSitePlanResult, type FestivalSitePlanDraft, type FestivalSitePlanResult } from "../domain/festivalSitePlan";
import { parseFestivalTicketPlanResult, type FestivalTicketPlanDraft, type FestivalTicketPlanResult } from "../domain/festivalTicketPlan";
import { parseFestivalArtistProgrammeResult, type FestivalApplicationWindow, type FestivalArtistProgramme, type FestivalArtistProgrammeResult } from "../domain/festivalArtistProgramme";
import {parseFestivalArtistActionResult,parseFestivalArtistCandidates,parseFestivalArtistOpportunities,type FestivalArtistActionResult} from "../domain/festivalArtistWorkflows";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown) => typeof value === "string" && UUID_RE.test(value);
const isFiniteNonNegative = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0;
const isNonNegativeInteger = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0;
const isNonEmptyString = (value: unknown) => typeof value === "string" && value.trim().length > 0;

interface FoundFestivalCompanyRpcResult {
  companyId: string;
  festivalCompanyId: string;
  personalCash: number;
  foundingCost: number;
  idempotent: boolean;
  personalFinancialTransactionId: string;
}

export const foundFestivalCompany = async (
  input: FoundFestivalCompanyInput,
): Promise<FoundFestivalCompanyResult> => {
  const { data, error } = await supabase.rpc("found_festival_company", {
    p_company_name: input.companyName,
    p_public_name: input.publicName,
    p_description: input.description || null,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw error;
  if (!isFoundFestivalCompanyRpcResult(data)) throw new Error("malformed_festival_foundation_result");
  const result = data;
  return {
    companyId: result.companyId,
    festivalCompanyId: result.festivalCompanyId,
    personalCash: Number(result.personalCash),
    foundingCost: Number(result.foundingCost),
    idempotent: result.idempotent,
  };
};

export const isFoundFestivalCompanyRpcResult = (value: unknown): value is FoundFestivalCompanyRpcResult => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isUuid(candidate.companyId) && isUuid(candidate.festivalCompanyId) && isUuid(candidate.personalFinancialTransactionId)
    && isFiniteNonNegative(candidate.personalCash)
    && Number(candidate.foundingCost) === 2_000_000
    && typeof candidate.idempotent === "boolean";
};

export const isFestivalSetupState = (value: unknown): value is FestivalCompanySetupState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isUuid(candidate.festivalCompanyId)
    && isUuid(candidate.companyId)
    && isNonEmptyString(candidate.publicName)
    && isNonEmptyString(candidate.legalCompanyName)
    && isFiniteNonNegative(candidate.companyBalance)
    && typeof candidate.isBankrupt === "boolean"
    && typeof candidate.setupCompleted === "boolean"
    && typeof candidate.configurationComplete === "boolean"
    && typeof candidate.firstEditionExists === "boolean";
};

export const getFestivalCompanySetup = async (festivalCompanyId: string): Promise<FestivalCompanySetupState> => {
  const { data, error } = await supabase.rpc("get_festival_company_setup", {
    p_festival_company_id: festivalCompanyId,
  });

  if (error) throw error;
  if (!isFestivalSetupState(data)) throw new Error("festival_company_not_found");

  return {
    ...data,
    companyBalance: Number(data.companyBalance),
    isBankrupt: Boolean(data.isBankrupt),
    setupCompleted: Boolean(data.setupCompleted),
    configurationComplete: Boolean(data.configurationComplete),
    firstEditionExists: Boolean(data.firstEditionExists),
    capabilities: isCapabilityObject(data.capabilities)
      ? { ...data.capabilities, companyLimit: Number(data.capabilities.companyLimit) }
      : disabledFestivalCompanyCapabilities,
  };
};


export const isCapabilityObject = (value: unknown): value is FestivalCompanyCapabilities => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.newFestivalSystemEnabled === "boolean"
    && typeof candidate.festivalCompanyCreationEnabled === "boolean"
    && typeof candidate.festivalCompanyManagementEnabled === "boolean"
    && typeof candidate.festivalConfigurationEnabled === "boolean"
    && isNonNegativeInteger(candidate.companyLimit);
};

export const getFestivalCompanyCapabilities = async (): Promise<FestivalCompanyCapabilities> => {
  const { data, error } = await supabase.rpc("festival_company_capabilities");
  if (error || !isCapabilityObject(data)) return disabledFestivalCompanyCapabilities;
  return { ...data, companyLimit: Number(data.companyLimit) };
};

export const getFestivalCompanyFoundingEligibility = async (): Promise<FestivalCompanyFoundingEligibility> => {
  const { data, error } = await supabase.rpc("get_festival_company_founding_eligibility");
  if (error) return disabledFestivalCompanyEligibility;
  return parseFestivalCompanyEligibility(data);
};

export interface OwnedFestivalCompanySummary {
  festivalCompanyId: string;
  companyId: string;
  publicName: string;
  legalCompanyName: string;
  setupStatus: string;
  setupCompleted: boolean;
  configurationComplete: boolean;
  firstEditionExists: boolean;
  companyBalance: number;
  managementEnabled: boolean;
}

export const isOwnedFestivalCompanySummary = (value: unknown): value is OwnedFestivalCompanySummary => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isUuid(candidate.festivalCompanyId)
    && isUuid(candidate.companyId)
    && isNonEmptyString(candidate.publicName)
    && isNonEmptyString(candidate.legalCompanyName)
    && typeof candidate.setupStatus === "string"
    && typeof candidate.setupCompleted === "boolean"
    && typeof candidate.configurationComplete === "boolean"
    && typeof candidate.firstEditionExists === "boolean"
    && isFiniteNonNegative(candidate.companyBalance)
    && typeof candidate.managementEnabled === "boolean";
};

export const getOwnedFestivalCompanies = async (): Promise<OwnedFestivalCompanySummary[]> => {
  const { data, error } = await supabase.rpc("get_owned_festival_companies");
  if (error || !Array.isArray(data)) return [];
  if (!data.every(isOwnedFestivalCompanySummary)) return [];
  return data.map((company) => ({
    ...company,
    setupCompleted: Boolean(company.setupCompleted),
    configurationComplete: Boolean(company.configurationComplete),
    firstEditionExists: Boolean(company.firstEditionExists),
    companyBalance: Number(company.companyBalance),
    managementEnabled: Boolean(company.managementEnabled),
  }));
};

export const getFestivalConfiguration = async (festivalCompanyId: string): Promise<FestivalConfiguration> => {
  if (!isUuid(festivalCompanyId)) throw new Error("festival_company_not_found");
  const { data, error } = await supabase.rpc("get_festival_configuration", { p_festival_company_id: festivalCompanyId });
  if (error) throw normalizeFestivalConfigurationError(error);
  return parseFestivalConfiguration(data);
};

export const saveFestivalConfiguration = async (input: { festivalCompanyId: string; expectedVersion: number; configuration: FestivalConfigurationDraft; idempotencyKey: string }): Promise<FestivalConfiguration> => {
  if (!isUuid(input.festivalCompanyId) || !isUuid(input.idempotencyKey) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw new Error("festival_configuration_invalid");
  const { data, error } = await supabase.rpc("save_festival_configuration", { p_festival_company_id: input.festivalCompanyId, p_expected_version: input.expectedVersion, p_configuration: input.configuration, p_idempotency_key: input.idempotencyKey });
  if (error) throw normalizeFestivalConfigurationError(error);
  return parseFestivalConfiguration(data);
};


const siteErrors: Record<string, string> = { festival_site_plan_forbidden: "festival_site_plan_forbidden", festival_configuration_incomplete: "festival_configuration_incomplete", festival_site_invalid: "festival_site_invalid", festival_venue_invalid: "festival_venue_invalid", festival_city_mismatch: "festival_city_mismatch", festival_capacity_invalid: "festival_capacity_invalid", festival_stage_invalid: "festival_stage_invalid", festival_stage_limit_exceeded: "festival_stage_limit_exceeded", festival_site_plan_stale: "festival_site_plan_stale", festival_site_plan_idempotency_conflict: "festival_site_plan_idempotency_conflict" };
const normalizeSiteError = (error: { message?: string }) => new Error(Object.entries(siteErrors).find(([key]) => error.message?.includes(key))?.[1] ?? "festival_site_plan_unavailable");
export const getFestivalSitePlan = async (festivalCompanyId: string): Promise<FestivalSitePlanResult> => {
  if (!isUuid(festivalCompanyId)) throw new Error("festival_site_plan_not_found");
  const { data, error } = await supabase.rpc("get_festival_site_plan", { p_festival_company_id: festivalCompanyId });
  if (error) throw normalizeSiteError(error);
  return parseFestivalSitePlanResult(data);
};
export const saveFestivalSitePlan = async (input: { festivalCompanyId: string; expectedVersion: number; draft: FestivalSitePlanDraft; idempotencyKey: string; complete?: boolean }): Promise<FestivalSitePlanResult> => {
  if (!isUuid(input.festivalCompanyId) || !isUuid(input.idempotencyKey) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw new Error("festival_site_invalid");
  const { data, error } = await supabase.rpc("save_festival_site_plan", { p_festival_company_id: input.festivalCompanyId, p_expected_version: input.expectedVersion, p_site_plan: input.draft.sitePlan, p_stages: input.draft.stages, p_idempotency_key: input.idempotencyKey, p_complete: input.complete ?? false });
  if (error) throw normalizeSiteError(error);
  return parseFestivalSitePlanResult(data);
};

const ticketErrors = ["festival_ticket_plan_forbidden","festival_site_plan_incomplete","festival_ticket_plan_invalid","festival_ticket_product_invalid","festival_ticket_capacity_invalid","festival_ticket_daily_capacity_exceeded","festival_ticket_release_invalid","festival_ticket_release_allocation_exceeded","festival_ticket_plan_incomplete","festival_ticket_plan_stale","festival_ticket_plan_idempotency_conflict"];
const normalizeTicketError=(error:{message?:string})=>new Error(ticketErrors.find(code=>error.message?.includes(code))??"festival_ticket_plan_unavailable");
export async function getFestivalTicketPlan(festivalCompanyId:string):Promise<FestivalTicketPlanResult>{if(!isUuid(festivalCompanyId))throw new Error("festival_ticket_plan_not_found");const {data,error}=await supabase.rpc("get_festival_ticket_plan",{p_festival_company_id:festivalCompanyId});if(error)throw normalizeTicketError(error);return parseFestivalTicketPlanResult(data);}
export async function saveFestivalTicketPlan(input:{festivalCompanyId:string;expectedVersion:number;draft:FestivalTicketPlanDraft;idempotencyKey:string;complete?:boolean}):Promise<FestivalTicketPlanResult>{if(!isUuid(input.festivalCompanyId)||!isUuid(input.idempotencyKey)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0)throw new Error("festival_ticket_plan_invalid");const {data,error}=await supabase.rpc("save_festival_ticket_plan",{p_festival_company_id:input.festivalCompanyId,p_expected_version:input.expectedVersion,p_ticket_plan:input.draft.ticketPlan,p_products:input.draft.products,p_release_phases:input.draft.releasePhases,p_capacity_allocations:input.draft.capacityAllocations,p_idempotency_key:input.idempotencyKey,p_complete:input.complete??false});if(error)throw normalizeTicketError(error);return parseFestivalTicketPlanResult(data);}

const artistErrors=["festival_artist_programme_forbidden","festival_ticket_plan_incomplete","festival_artist_programme_invalid","festival_artist_application_invalid","festival_artist_application_duplicate","festival_artist_application_closed","festival_artist_invitation_invalid","festival_artist_offer_invalid","festival_artist_offer_budget_exceeded","festival_artist_offer_stale","festival_artist_unavailable","festival_artist_stage_unsuitable","festival_artist_idempotency_conflict","festival_artist_action_forbidden","festival_artist_programme_stale"];
const normalizeArtistError=(error:{message?:string})=>new Error(artistErrors.find(code=>error.message?.includes(code))??"festival_artist_programme_unavailable");
export async function getFestivalArtistProgramme(festivalCompanyId:string):Promise<FestivalArtistProgrammeResult>{if(!isUuid(festivalCompanyId))throw new Error("festival_artist_programme_unavailable");const {data,error}=await supabase.rpc("get_festival_artist_programme",{p_festival_company_id:festivalCompanyId});if(error)throw normalizeArtistError(error);return parseFestivalArtistProgrammeResult(data);}
export async function saveFestivalArtistProgramme(input:{festivalCompanyId:string;expectedVersion:number;programme:FestivalArtistProgramme;applicationWindows:FestivalApplicationWindow[];idempotencyKey:string;complete?:boolean}):Promise<FestivalArtistProgrammeResult>{if(!isUuid(input.festivalCompanyId)||!isUuid(input.idempotencyKey)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0)throw new Error("festival_artist_programme_invalid");const {data,error}=await supabase.rpc("save_festival_artist_programme",{p_festival_company_id:input.festivalCompanyId,p_expected_version:input.expectedVersion,p_programme:input.programme,p_application_windows:input.applicationWindows,p_idempotency_key:input.idempotencyKey,p_complete:input.complete??false});if(error)throw normalizeArtistError(error);return parseFestivalArtistProgrammeResult(data);}

// Phase 4B uses action RPCs exclusively: contractual rows are never mutated from the browser.
const actionErrorCodes=["festival_artist_action_forbidden","festival_artist_applications_closed","festival_artist_application_window_invalid","festival_artist_not_eligible","festival_artist_application_duplicate","festival_artist_already_booked","festival_artist_application_forbidden","festival_artist_invitation_duplicate","festival_artist_invitation_invalid_transition","festival_artist_application_invalid_transition","festival_artist_offer_invalid_transition","festival_artist_booking_invalid_transition","festival_artist_offer_budget_exceeded","festival_artist_offer_stale","festival_artist_idempotency_conflict"];
const actionError=(error:{message?:string})=>new Error(actionErrorCodes.find(x=>error.message?.includes(x))??"festival_artist_action_unavailable");
const rpcAction=async(name:string,args:Record<string,unknown>):Promise<FestivalArtistActionResult>=>{const {data,error}=await supabase.rpc(name as never,args as never);if(error)throw actionError(error);return parseFestivalArtistActionResult(data)};
export async function getMyFestivalArtistOpportunities(){const {data,error}=await supabase.rpc("get_my_festival_artist_opportunities");if(error)throw actionError(error);return parseFestivalArtistOpportunities(data)}
export async function searchFestivalArtistCandidates(input:{festivalCompanyId:string;query?:string;artistType?:string;genres?:string[];minimumFame?:number;maximumFame?:number;limit?:number;offset?:number}){if(!isUuid(input.festivalCompanyId))throw new Error("festival_artist_action_forbidden");const {data,error}=await supabase.rpc("search_festival_artist_candidates",{p_festival_company_id:input.festivalCompanyId,p_query:input.query??null,p_artist_type:input.artistType??null,p_genres:input.genres??[],p_minimum_fame:input.minimumFame??null,p_maximum_fame:input.maximumFame??null,p_limit:input.limit??25,p_offset:input.offset??0});if(error)throw actionError(error);return parseFestivalArtistCandidates(data)}
export const submitFestivalArtistApplication=(i:Record<string,unknown>)=>rpcAction("submit_festival_artist_application",i);
export const withdrawFestivalArtistApplication=(i:Record<string,unknown>)=>rpcAction("withdraw_festival_artist_application",i);
export const reviewFestivalArtistApplication=(i:Record<string,unknown>)=>rpcAction("review_festival_artist_application",i);
export const sendFestivalArtistInvitation=(i:Record<string,unknown>)=>rpcAction("send_festival_artist_invitation",i);
export const respondToFestivalArtistInvitation=(i:Record<string,unknown>)=>rpcAction("respond_to_festival_artist_invitation",i);
export const createFestivalArtistOffer=(i:Record<string,unknown>)=>rpcAction("create_festival_artist_offer",i);
export const sendFestivalArtistOffer=(i:Record<string,unknown>)=>rpcAction("send_festival_artist_offer",i);
export const counterFestivalArtistOffer=(i:Record<string,unknown>)=>rpcAction("counter_festival_artist_offer",i);
export const respondToFestivalArtistOffer=(i:Record<string,unknown>)=>rpcAction("respond_to_festival_artist_offer",i);
export const withdrawFestivalArtistOffer=(i:Record<string,unknown>)=>rpcAction("withdraw_festival_artist_offer",i);
export const cancelFestivalArtistBooking=(i:Record<string,unknown>)=>rpcAction("cancel_festival_artist_booking",i);
