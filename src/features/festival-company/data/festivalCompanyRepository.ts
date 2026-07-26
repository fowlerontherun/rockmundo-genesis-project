import { supabase } from "@/integrations/supabase/client";
import type { FoundFestivalCompanyInput, FoundFestivalCompanyResult } from "../domain/festivalCompany";
import type { FestivalCompanySetupState } from "../domain/festivalSetup";
import { disabledFestivalCompanyCapabilities, type FestivalCompanyCapabilities } from "../domain/festivalCapabilities";
import { disabledFestivalCompanyEligibility, parseFestivalCompanyEligibility, type FestivalCompanyFoundingEligibility } from "../domain/festivalEligibility";
import { parseFestivalConfiguration, type FestivalConfiguration, type FestivalConfigurationDraft } from "../domain/festivalConfiguration";
import { normalizeFestivalConfigurationError } from "../domain/festivalConfigurationErrors";
import { parseFestivalSitePlanResult, type FestivalSitePlanDraft, type FestivalSitePlanResult } from "../domain/festivalSitePlan";

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
