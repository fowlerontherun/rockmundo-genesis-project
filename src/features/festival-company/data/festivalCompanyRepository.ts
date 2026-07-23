import { supabase } from "@/integrations/supabase/client";
import type { FoundFestivalCompanyInput, FoundFestivalCompanyResult } from "../domain/festivalCompany";
import type { FestivalCompanySetupState } from "../domain/festivalSetup";
import { disabledFestivalCompanyCapabilities, type FestivalCompanyCapabilities } from "../domain/festivalCapabilities";
import { disabledFestivalCompanyEligibility, parseFestivalCompanyEligibility, type FestivalCompanyFoundingEligibility } from "../domain/festivalEligibility";

interface FoundFestivalCompanyRpcResult {
  companyId: string;
  festivalCompanyId: string;
  personalCash: number;
  foundingCost: number;
  idempotent: boolean;
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
  const result = data as FoundFestivalCompanyRpcResult;
  return {
    companyId: result.companyId,
    festivalCompanyId: result.festivalCompanyId,
    personalCash: Number(result.personalCash),
    foundingCost: Number(result.foundingCost),
    idempotent: Boolean(result.idempotent),
  };
};

const isFestivalSetupState = (value: unknown): value is FestivalCompanySetupState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.festivalCompanyId === "string"
    && typeof candidate.companyId === "string"
    && typeof candidate.publicName === "string"
    && typeof candidate.legalCompanyName === "string";
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
    capabilities: { ...disabledFestivalCompanyCapabilities, ...(data.capabilities ?? {}) },
  };
};


const isCapabilityObject = (value: unknown): value is FestivalCompanyCapabilities => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.newFestivalSystemEnabled === "boolean"
    && typeof candidate.festivalCompanyCreationEnabled === "boolean"
    && typeof candidate.festivalCompanyManagementEnabled === "boolean"
    && typeof candidate.festivalConfigurationEnabled === "boolean"
    && Number.isFinite(Number(candidate.companyLimit));
};

export const getFestivalCompanyCapabilities = async (): Promise<FestivalCompanyCapabilities> => {
  const { data, error } = await supabase.rpc("festival_company_capabilities");
  if (error || !isCapabilityObject(data)) return disabledFestivalCompanyCapabilities;
  return { ...data, companyLimit: Number(data.companyLimit) };
};

export const getFestivalCompanyFoundingEligibility = async (): Promise<FestivalCompanyFoundingEligibility> => {
  const { data, error } = await supabase.rpc("get_festival_company_founding_eligibility" as never);
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

const isOwnedFestivalCompanySummary = (value: unknown): value is OwnedFestivalCompanySummary => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.festivalCompanyId === "string" && typeof candidate.companyId === "string" && typeof candidate.publicName === "string" && typeof candidate.legalCompanyName === "string";
};

export const getOwnedFestivalCompanies = async (): Promise<OwnedFestivalCompanySummary[]> => {
  const { data, error } = await supabase.rpc("get_owned_festival_companies" as never);
  if (error || !Array.isArray(data)) return [];
  return data.filter(isOwnedFestivalCompanySummary).map((company) => ({
    ...company,
    setupCompleted: Boolean(company.setupCompleted),
    configurationComplete: Boolean(company.configurationComplete),
    firstEditionExists: Boolean(company.firstEditionExists),
    companyBalance: Number(company.companyBalance),
    managementEnabled: Boolean(company.managementEnabled),
  }));
};
