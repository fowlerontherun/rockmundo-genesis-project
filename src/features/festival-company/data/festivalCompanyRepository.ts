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
import {isFestivalUuid,parseFestivalLaunch,parseFestivalTicketProduct,parseFestivalTicketPurchase,parseFestivalTicketWallet,parsePublicFestival,type FestivalPublicProfile} from "../domain/festivalLaunch";
type UntypedRpc=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{message?:string}|null}>;

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
const artistRpc=supabase.rpc.bind(supabase) as unknown as UntypedRpc;
const rpcAction=async(name:string,args:Record<string,unknown>):Promise<FestivalArtistActionResult>=>{const {data,error}=await artistRpc(name,args);if(error)throw actionError(error);return parseFestivalArtistActionResult(data)};
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

// Phase 5 RPC boundary: all operational writes are transactional server actions.
import {parseFestivalOperationsResult,type FestivalOperationsDraft,type FestivalOperationsResult} from "../domain/festivalOperationsPlan";
import {parseFestivalOperationsActionResult,parseFestivalStaffVacancies,parseFestivalSupplierOpportunities} from "../domain/festivalOperationsWorkflows";
const operationsRpc=supabase.rpc.bind(supabase) as unknown as UntypedRpc;
const operationsErrors=["festival_operations_forbidden","festival_operations_prerequisite_incomplete","festival_operations_plan_stale","festival_operations_currency_mismatch","festival_operations_idempotency_conflict","festival_staff_application_stale","festival_staff_assignment_stale","festival_supplier_quote_stale","festival_supplier_contract_stale","festival_security_coverage_insufficient","festival_supplier_requirement_uncovered","festival_operations_action_invalid"];
const normalizeOperationsError=(error:{message?:string})=>new Error(operationsErrors.find(code=>error.message?.includes(code))??"festival_operations_unavailable");
export async function getFestivalOperationsPlan(festivalCompanyId:string):Promise<FestivalOperationsResult>{if(!isUuid(festivalCompanyId))throw new Error("festival_operations_forbidden");const {data,error}=await operationsRpc("get_festival_operations_plan",{p_festival_company_id:festivalCompanyId});if(error)throw normalizeOperationsError(error);return parseFestivalOperationsResult(data)}
export async function saveFestivalOperationsPlan(input:{festivalCompanyId:string;expectedVersion:number;plan:FestivalOperationsDraft;idempotencyKey:string;complete?:boolean}):Promise<FestivalOperationsResult>{if(!isUuid(input.festivalCompanyId)||!isUuid(input.idempotencyKey)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new Error("festival_operations_plan_invalid");const {data,error}=await operationsRpc("save_festival_operations_plan",{p_festival_company_id:input.festivalCompanyId,p_expected_version:input.expectedVersion,p_plan:input.plan,p_idempotency_key:input.idempotencyKey,p_complete:input.complete??false});if(error)throw normalizeOperationsError(error);return parseFestivalOperationsResult(data)}
export async function festivalOperationsAction(action:string,payload:Record<string,unknown>,idempotencyKey:string):Promise<unknown>{if(!isUuid(idempotencyKey)||!operationsActionNames.has(action))throw new Error("festival_operations_action_invalid");const {data,error}=await operationsRpc(action,{p_payload:payload,p_idempotency_key:idempotencyKey});if(error)throw normalizeOperationsError(error);return parseFestivalOperationsActionResult(data)}
export async function getAvailableFestivalStaffVacancies(filters:Record<string,unknown>={}){const {data,error}=await operationsRpc("get_available_festival_staff_vacancies",{p_filters:filters});if(error)throw normalizeOperationsError(error);return parseFestivalStaffVacancies(data)}
export async function getAvailableFestivalSupplierOpportunities(filters:Record<string,unknown>={}){const {data,error}=await operationsRpc("get_available_festival_supplier_opportunities",{p_filters:filters});if(error)throw normalizeOperationsError(error);return parseFestivalSupplierOpportunities(data)}
const operationsActionNames=new Set(["publish_festival_staff_vacancy","apply_for_festival_staff_vacancy","withdraw_festival_staff_application","review_festival_staff_application","hire_festival_staff_applicant","hire_festival_npc_staff","assign_festival_staff_shift","cancel_festival_staff_assignment","publish_festival_supplier_requirement","submit_festival_supplier_quote","withdraw_festival_supplier_quote","review_festival_supplier_quote","accept_festival_supplier_quote","cancel_festival_supplier_contract","refresh_festival_npc_supplier_quotes"]);
export const publishFestivalStaffVacancy=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("publish_festival_staff_vacancy",p,k);
export const applyForFestivalStaffVacancy=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("apply_for_festival_staff_vacancy",p,k);
export const withdrawFestivalStaffApplication=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("withdraw_festival_staff_application",p,k);
export const reviewFestivalStaffApplication=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("review_festival_staff_application",p,k);
export const hireFestivalStaffApplicant=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("hire_festival_staff_applicant",p,k);
export const hireFestivalNpcStaff=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("hire_festival_npc_staff",p,k);
export const assignFestivalStaffShift=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("assign_festival_staff_shift",p,k);
export const cancelFestivalStaffAssignment=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("cancel_festival_staff_assignment",p,k);
export const publishFestivalSupplierRequirement=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("publish_festival_supplier_requirement",p,k);
export const submitFestivalSupplierQuote=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("submit_festival_supplier_quote",p,k);
export const withdrawFestivalSupplierQuote=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("withdraw_festival_supplier_quote",p,k);
export const reviewFestivalSupplierQuote=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("review_festival_supplier_quote",p,k);
export const acceptFestivalSupplierQuote=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("accept_festival_supplier_quote",p,k);
export const cancelFestivalSupplierContract=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("cancel_festival_supplier_contract",p,k);
export const refreshFestivalNpcSupplierQuotes=(p:Record<string,unknown>,k:string)=>festivalOperationsAction("refresh_festival_npc_supplier_quotes",p,k);

// Phase 6 sponsorship boundary. Commercial rows are only mutated by narrowly scoped RPCs.
import {parseFestivalSponsorshipOpportunities,parseFestivalSponsorshipResult,parseFestivalSponsorActionResult,type FestivalSponsorshipDraft,type FestivalSponsorshipResult} from "../domain/festivalSponsorship";
const sponsorshipRpc=supabase.rpc.bind(supabase) as unknown as UntypedRpc;
const sponsorshipErrors=["festival_sponsorship_forbidden","festival_sponsorship_prerequisite_incomplete","festival_sponsorship_plan_stale","festival_sponsor_application_stale","festival_sponsor_invitation_stale","festival_sponsor_proposal_stale","festival_sponsor_contract_stale","festival_sponsorship_inventory_stale","festival_sponsor_currency_mismatch","festival_sponsor_exclusivity_conflict","festival_sponsor_inventory_overallocated","festival_sponsor_contribution_unaffordable","festival_sponsorship_idempotency_conflict","festival_sponsor_action_invalid"];
const normalizeSponsorshipError=(e:{message?:string})=>new Error(sponsorshipErrors.find(code=>e.message?.includes(code))??"festival_sponsorship_unavailable");
export async function getFestivalSponsorshipPlan(festivalCompanyId:string):Promise<FestivalSponsorshipResult>{if(!isUuid(festivalCompanyId))throw new Error("festival_sponsorship_forbidden");const {data,error}=await sponsorshipRpc("get_festival_sponsorship_plan",{p_festival_company_id:festivalCompanyId});if(error)throw normalizeSponsorshipError(error);return parseFestivalSponsorshipResult(data)}
export async function saveFestivalSponsorshipPlan(input:{festivalCompanyId:string;expectedVersion:number;plan:FestivalSponsorshipDraft;packages:Record<string,unknown>[];inventory:Record<string,unknown>[];idempotencyKey:string;complete?:boolean}){if(!isUuid(input.festivalCompanyId)||!isUuid(input.idempotencyKey)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new Error("festival_sponsorship_plan_invalid");const {data,error}=await sponsorshipRpc("save_festival_sponsorship_plan",{p_festival_company_id:input.festivalCompanyId,p_expected_version:input.expectedVersion,p_plan:input.plan,p_packages:input.packages,p_inventory:input.inventory,p_idempotency_key:input.idempotencyKey,p_complete:input.complete??false});if(error)throw normalizeSponsorshipError(error);return parseFestivalSponsorshipResult(data)}
export async function getAvailableFestivalSponsorshipOpportunities(filters:Record<string,unknown>={}){const {data,error}=await sponsorshipRpc("get_available_festival_sponsorship_opportunities",{p_filters:filters});if(error)throw normalizeSponsorshipError(error);return parseFestivalSponsorshipOpportunities(data)}
const sponsorActions=new Set(["search_festival_sponsor_prospects","refresh_festival_npc_sponsor_prospects","open_festival_sponsor_applications","close_festival_sponsor_applications","submit_festival_sponsor_application","withdraw_festival_sponsor_application","review_festival_sponsor_application","send_festival_sponsor_invitation","respond_to_festival_sponsor_invitation","create_festival_sponsor_proposal","send_festival_sponsor_proposal","counter_festival_sponsor_proposal","respond_to_festival_sponsor_proposal","withdraw_festival_sponsor_proposal","cancel_festival_sponsor_contract"]);
async function sponsorshipAction(action:string,payload:Record<string,unknown>,idempotencyKey:string){if(!sponsorActions.has(action)||!isUuid(idempotencyKey))throw new Error("festival_sponsor_action_invalid");const {data,error}=await sponsorshipRpc(action,{p_payload:payload,p_idempotency_key:idempotencyKey});if(error)throw normalizeSponsorshipError(error);return parseFestivalSponsorActionResult(data)}
export const searchFestivalSponsorProspects=(p:Record<string,unknown>,k:string)=>sponsorshipAction("search_festival_sponsor_prospects",p,k);
export const refreshFestivalNpcSponsorProspects=(p:Record<string,unknown>,k:string)=>sponsorshipAction("refresh_festival_npc_sponsor_prospects",p,k);
export const openFestivalSponsorApplications=(p:Record<string,unknown>,k:string)=>sponsorshipAction("open_festival_sponsor_applications",p,k);
export const closeFestivalSponsorApplications=(p:Record<string,unknown>,k:string)=>sponsorshipAction("close_festival_sponsor_applications",p,k);
export const submitFestivalSponsorApplication=(p:Record<string,unknown>,k:string)=>sponsorshipAction("submit_festival_sponsor_application",p,k);
export const withdrawFestivalSponsorApplication=(p:Record<string,unknown>,k:string)=>sponsorshipAction("withdraw_festival_sponsor_application",p,k);
export const reviewFestivalSponsorApplication=(p:Record<string,unknown>,k:string)=>sponsorshipAction("review_festival_sponsor_application",p,k);
export const sendFestivalSponsorInvitation=(p:Record<string,unknown>,k:string)=>sponsorshipAction("send_festival_sponsor_invitation",p,k);
export const respondToFestivalSponsorInvitation=(p:Record<string,unknown>,k:string)=>sponsorshipAction("respond_to_festival_sponsor_invitation",p,k);
export const createFestivalSponsorProposal=(p:Record<string,unknown>,k:string)=>sponsorshipAction("create_festival_sponsor_proposal",p,k);
export const sendFestivalSponsorProposal=(p:Record<string,unknown>,k:string)=>sponsorshipAction("send_festival_sponsor_proposal",p,k);
export const counterFestivalSponsorProposal=(p:Record<string,unknown>,k:string)=>sponsorshipAction("counter_festival_sponsor_proposal",p,k);
export const respondToFestivalSponsorProposal=(p:Record<string,unknown>,k:string)=>sponsorshipAction("respond_to_festival_sponsor_proposal",p,k);
export const withdrawFestivalSponsorProposal=(p:Record<string,unknown>,k:string)=>sponsorshipAction("withdraw_festival_sponsor_proposal",p,k);
export const cancelFestivalSponsorContract=(p:Record<string,unknown>,k:string)=>sponsorshipAction("cancel_festival_sponsor_contract",p,k);

// Phase 7A timetable boundary. The browser never writes timetable tables or derived readiness data.
import {parseFestivalTimetableActionResult,parseFestivalTimetablePlan,type FestivalTimetablePlan} from "../domain/festivalTimetablePlan";
const timetableRpc=supabase.rpc.bind(supabase) as unknown as UntypedRpc;
const timetableErrors=["festival_timetable_not_unlocked","festival_timetable_stale","festival_stage_window_invalid","festival_stage_slot_overlap","festival_stage_curfew_exceeded","festival_artist_booking_not_confirmed","festival_artist_unavailable","festival_band_member_unavailable","festival_artist_travel_impossible","festival_artist_already_scheduled","festival_soundcheck_conflict","festival_changeover_too_short","festival_stage_manager_missing","festival_stage_manager_forbidden","festival_staff_coverage_missing","festival_supplier_delivery_invalid","festival_sponsor_activation_invalid","festival_schedule_blocking_conflict","festival_financial_readiness_failed","festival_readiness_incomplete","festival_timetable_idempotency_conflict"];
const normalizeTimetableError=(e:{message?:string})=>new Error(timetableErrors.find(code=>e.message?.includes(code))??"festival_timetable_unavailable");
const validTimetableInput=(i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string})=>isUuid(i.festivalCompanyId)&&isUuid(i.idempotencyKey)&&Number.isSafeInteger(i.expectedVersion)&&i.expectedVersion>=0;
export async function getFestivalTimetablePlan(festivalCompanyId:string):Promise<FestivalTimetablePlan>{if(!isUuid(festivalCompanyId))throw new Error("festival_timetable_unavailable");const {data,error}=await timetableRpc("get_festival_timetable_plan",{p_festival_company_id:festivalCompanyId});if(error)throw normalizeTimetableError(error);return parseFestivalTimetablePlan(data)}
export async function saveFestivalTimetablePlan(i:{festivalCompanyId:string;expectedVersion:number;plan:Record<string,unknown>;stageWindows:unknown[];slots:unknown[];idempotencyKey:string;complete?:boolean}){if(!validTimetableInput(i))throw new Error("festival_timetable_stale");const {data,error}=await timetableRpc("save_festival_timetable_plan",{p_festival_company_id:i.festivalCompanyId,p_expected_version:i.expectedVersion,p_plan:i.plan,p_stage_windows:i.stageWindows,p_slots:i.slots,p_idempotency_key:i.idempotencyKey,p_complete:i.complete??false});if(error)throw normalizeTimetableError(error);return parseFestivalTimetableActionResult(data)}
export async function generateFestivalTimetableSuggestions(i:{festivalCompanyId:string;expectedVersion:number;generationMode:"fill_empty_slots"|"rebalance"|"full_regeneration";idempotencyKey:string}){if(!validTimetableInput(i))throw new Error("festival_timetable_stale");const {data,error}=await timetableRpc("generate_festival_timetable_suggestions",{p_festival_company_id:i.festivalCompanyId,p_expected_version:i.expectedVersion,p_generation_mode:i.generationMode,p_idempotency_key:i.idempotencyKey});if(error)throw normalizeTimetableError(error);if(!data||typeof data!=="object")throw new Error("malformed_festival_timetable_action_result");return data as Record<string,unknown>}
const timetableActionNames=["assign_festival_artist_to_slot","move_festival_artist_slot","remove_festival_artist_from_slot","lock_festival_stage_slot","unlock_festival_stage_slot","schedule_festival_artist_soundcheck","assign_festival_stage_manager","remove_festival_stage_manager","schedule_festival_operational_item","move_festival_operational_item","cancel_festival_operational_item","schedule_festival_supplier_delivery","move_festival_supplier_delivery","cancel_festival_supplier_delivery","schedule_festival_sponsor_activation","move_festival_sponsor_activation","cancel_festival_sponsor_activation"] as const;
type TimetableActionName=(typeof timetableActionNames)[number];
async function runTimetableAction(name:TimetableActionName,payload:Record<string,unknown>,idempotencyKey:string){if(!isUuid(idempotencyKey)||!timetableActionNames.includes(name))throw new Error("festival_timetable_unavailable");const {data,error}=await timetableRpc(name,{p_payload:payload,p_idempotency_key:idempotencyKey});if(error)throw normalizeTimetableError(error);return parseFestivalTimetableActionResult(data)}
export const assignFestivalArtistToSlot=(p:Record<string,unknown>,k:string)=>runTimetableAction("assign_festival_artist_to_slot",p,k);export const moveFestivalArtistSlot=(p:Record<string,unknown>,k:string)=>runTimetableAction("move_festival_artist_slot",p,k);export const removeFestivalArtistFromSlot=(p:Record<string,unknown>,k:string)=>runTimetableAction("remove_festival_artist_from_slot",p,k);export const lockFestivalStageSlot=(p:Record<string,unknown>,k:string)=>runTimetableAction("lock_festival_stage_slot",p,k);export const unlockFestivalStageSlot=(p:Record<string,unknown>,k:string)=>runTimetableAction("unlock_festival_stage_slot",p,k);export const scheduleFestivalArtistSoundcheck=(p:Record<string,unknown>,k:string)=>runTimetableAction("schedule_festival_artist_soundcheck",p,k);export const assignFestivalStageManager=(p:Record<string,unknown>,k:string)=>runTimetableAction("assign_festival_stage_manager",p,k);export const removeFestivalStageManager=(p:Record<string,unknown>,k:string)=>runTimetableAction("remove_festival_stage_manager",p,k);export const scheduleFestivalOperationalItem=(p:Record<string,unknown>,k:string)=>runTimetableAction("schedule_festival_operational_item",p,k);export const moveFestivalOperationalItem=(p:Record<string,unknown>,k:string)=>runTimetableAction("move_festival_operational_item",p,k);export const cancelFestivalOperationalItem=(p:Record<string,unknown>,k:string)=>runTimetableAction("cancel_festival_operational_item",p,k);export const scheduleFestivalSupplierDelivery=(p:Record<string,unknown>,k:string)=>runTimetableAction("schedule_festival_supplier_delivery",p,k);export const moveFestivalSupplierDelivery=(p:Record<string,unknown>,k:string)=>runTimetableAction("move_festival_supplier_delivery",p,k);export const cancelFestivalSupplierDelivery=(p:Record<string,unknown>,k:string)=>runTimetableAction("cancel_festival_supplier_delivery",p,k);export const scheduleFestivalSponsorActivation=(p:Record<string,unknown>,k:string)=>runTimetableAction("schedule_festival_sponsor_activation",p,k);export const moveFestivalSponsorActivation=(p:Record<string,unknown>,k:string)=>runTimetableAction("move_festival_sponsor_activation",p,k);export const cancelFestivalSponsorActivation=(p:Record<string,unknown>,k:string)=>runTimetableAction("cancel_festival_sponsor_activation",p,k);
async function timetableLifecycle(name:"recalculate_festival_readiness"|"complete_festival_timetable_plan",i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string}){if(!validTimetableInput(i))throw new Error("festival_timetable_stale");const {data,error}=await timetableRpc(name,{p_festival_company_id:i.festivalCompanyId,p_expected_version:i.expectedVersion,p_idempotency_key:i.idempotencyKey});if(error)throw normalizeTimetableError(error);return parseFestivalTimetableActionResult(data)}
export const recalculateFestivalReadiness=(i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string})=>timetableLifecycle("recalculate_festival_readiness",i);export const completeFestivalTimetablePlan=(i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string})=>timetableLifecycle("complete_festival_timetable_plan",i);

const launchRpc=supabase.rpc.bind(supabase) as unknown as UntypedRpc;
const launchErrors=["festival_launch_not_ready","festival_launch_snapshot_stale","festival_launch_review_required","festival_launch_already_completed","festival_public_profile_invalid","festival_public_slug_taken","festival_ticket_sales_not_open","festival_ticket_sales_paused","festival_ticket_sales_closed","festival_ticket_product_unavailable","festival_ticket_phase_inactive","festival_ticket_quantity_invalid","festival_ticket_purchase_limit_exceeded","festival_ticket_sold_out","festival_ticket_insufficient_funds","festival_ticket_purchase_stale","festival_ticket_purchase_idempotency_conflict","festival_complimentary_allocation_exceeded","festival_cancellation_not_permitted"];
const normalizeLaunchError=(e:{message?:string})=>new Error(launchErrors.find(code=>e.message?.includes(code))??"festival_launch_unavailable");
async function launchCall(name:string,args?:Record<string,unknown>){const {data,error}=await launchRpc(name,args);if(error)throw normalizeLaunchError(error);return data}
const validAction=(i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string})=>isFestivalUuid(i.festivalCompanyId)&&isFestivalUuid(i.idempotencyKey)&&Number.isSafeInteger(i.expectedVersion)&&i.expectedVersion>=0;
export const getFestivalLaunchPlan=async(festivalCompanyId:string)=>{if(!isFestivalUuid(festivalCompanyId))throw new Error("festival_launch_unavailable");return launchCall("get_festival_launch_plan",{p_festival_company_id:festivalCompanyId})};
export const saveFestivalPublicProfile=async(i:{festivalCompanyId:string;expectedVersion:number;profile:Omit<FestivalPublicProfile,"festivalCompanyId"|"publicVersion">;idempotencyKey:string})=>{if(!validAction(i))throw new Error("festival_public_profile_invalid");return launchCall("save_festival_public_profile",{p_festival_company_id:i.festivalCompanyId,p_expected_version:i.expectedVersion,p_profile:i.profile,p_idempotency_key:i.idempotencyKey})};
export const beginFestivalLaunchReview=async(i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string})=>{if(!validAction(i))throw new Error("festival_launch_not_ready");return parseFestivalLaunch(await launchCall("begin_festival_launch_review",{p_festival_company_id:i.festivalCompanyId,p_expected_version:i.expectedVersion,p_idempotency_key:i.idempotencyKey}))};
export const launchFestival=async(i:{festivalCompanyId:string;expectedVersion:number;publicProfileVersion:number;idempotencyKey:string})=>{if(!validAction(i))throw new Error("festival_launch_review_required");return parseFestivalLaunch(await launchCall("launch_festival",{p_festival_company_id:i.festivalCompanyId,p_expected_version:i.expectedVersion,p_public_profile_version:i.publicProfileVersion,p_idempotency_key:i.idempotencyKey}))};
const salesAction=async(name:string,i:{festivalCompanyId:string;expectedVersion:number;idempotencyKey:string;reason?:string})=>{if(!validAction(i))throw new Error("festival_ticket_purchase_stale");return parseFestivalLaunch(await launchCall(name,{p_festival_company_id:i.festivalCompanyId,p_expected_launch_version:i.expectedVersion,...(i.reason?{p_reason:i.reason}:{}),p_idempotency_key:i.idempotencyKey}))};
export const openFestivalTicketSales=(i:Parameters<typeof salesAction>[1])=>salesAction("open_festival_ticket_sales",i);export const pauseFestivalTicketSales=(i:Parameters<typeof salesAction>[1])=>salesAction("pause_festival_ticket_sales",i);export const resumeFestivalTicketSales=(i:Parameters<typeof salesAction>[1])=>salesAction("resume_festival_ticket_sales",i);export const closeFestivalTicketSales=(i:Parameters<typeof salesAction>[1])=>salesAction("close_festival_ticket_sales",i);
export const getPublicFestival=async(slug:string)=>{if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error("malformed_public_festival_result");return parsePublicFestival(await launchCall("get_public_festival",{p_slug:slug}))};
export const getPublicFestivalDirectory=async(filters:Record<string,unknown>={})=>{const v=await launchCall("get_public_festival_directory",{p_filters:filters});if(!Array.isArray(v))throw new Error("malformed_public_festival_result");return v.map(parsePublicFestival)};
export const getPublicFestivalTimetable=async(slug:string)=>{if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error("malformed_public_festival_result");const v=await launchCall("get_public_festival_timetable",{p_slug:slug});if(!Array.isArray(v))throw new Error("malformed_public_festival_result");return (await getPublicFestival(slug)).timetable};
export const getPublicFestivalTicketProducts=async(launchId:string)=>{if(!isFestivalUuid(launchId))throw new Error("malformed_festival_ticket_product_result");const v=await launchCall("get_public_festival_ticket_products",{p_festival_launch_id:launchId});if(!Array.isArray(v))throw new Error("malformed_festival_ticket_product_result");return v.map(parseFestivalTicketProduct)};
export const purchaseFestivalTickets=async(i:{festivalLaunchId:string;ticketProductId:string;quantity:number;idempotencyKey:string})=>{if(!isFestivalUuid(i.festivalLaunchId)||!isFestivalUuid(i.ticketProductId)||!isFestivalUuid(i.idempotencyKey)||!Number.isSafeInteger(i.quantity))throw new Error("festival_ticket_quantity_invalid");return parseFestivalTicketPurchase(await launchCall("purchase_festival_tickets",{p_festival_launch_id:i.festivalLaunchId,p_ticket_product_id:i.ticketProductId,p_quantity:i.quantity,p_idempotency_key:i.idempotencyKey}))};
export const issueFestivalComplimentaryTickets=(i:Record<string,unknown>)=>launchCall("issue_festival_complimentary_tickets",i);
export const getFestivalTicketSalesSummary=(festivalCompanyId:string)=>launchCall("get_festival_ticket_sales_summary",{p_festival_company_id:festivalCompanyId});
export const getMyFestivalTickets=async()=>parseFestivalTicketWallet(await launchCall("get_my_festival_tickets"));
export const cancelLaunchedFestival=(i:{festivalCompanyId:string;expectedVersion:number;reason:string;confirmationToken:string;idempotencyKey:string})=>launchCall("cancel_launched_festival",{p_festival_company_id:i.festivalCompanyId,p_expected_launch_version:i.expectedVersion,p_reason:i.reason,p_confirmation_token:i.confirmationToken,p_idempotency_key:i.idempotencyKey});
