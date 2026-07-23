import { supabase } from "@/integrations/supabase/client";
import { parseFoundFestivalCompanyResult, type FoundFestivalCompanyInput, type FoundFestivalCompanyResult } from "../domain/festivalCompany";
import type { FestivalCompanySetupState } from "../domain/festivalSetup";
import { disabledFestivalCompanyCapabilities, parseFestivalCompanyCapabilities, type FestivalCompanyCapabilities } from "../domain/festivalCapabilities";
import { disabledFestivalCompanyEligibility, parseFestivalCompanyEligibility, type FestivalCompanyFoundingEligibility } from "../domain/festivalEligibility";

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
  return parseFoundFestivalCompanyResult(data);
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


export const getFestivalCompanyCapabilities = async (): Promise<FestivalCompanyCapabilities> => {
  const { data, error } = await supabase.rpc("festival_company_capabilities");
  if (error) return disabledFestivalCompanyCapabilities;
  return parseFestivalCompanyCapabilities(data);
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isNonEmptyString = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const parseOwnedFestivalCompanySummary = (value: unknown): OwnedFestivalCompanySummary => {
  if (!value || typeof value !== "object") throw new Error("malformed_owned_festival_company");
  const candidate = value as Record<string, unknown>;
  if (!isNonEmptyString(candidate.festivalCompanyId) || !uuidPattern.test(candidate.festivalCompanyId)) throw new Error("malformed_owned_festival_company");
  if (!isNonEmptyString(candidate.companyId) || !uuidPattern.test(candidate.companyId)) throw new Error("malformed_owned_festival_company");
  if (!isNonEmptyString(candidate.publicName) || !isNonEmptyString(candidate.legalCompanyName) || !isNonEmptyString(candidate.setupStatus)) throw new Error("malformed_owned_festival_company");
  if (typeof candidate.setupCompleted !== "boolean" || typeof candidate.configurationComplete !== "boolean" || typeof candidate.firstEditionExists !== "boolean" || typeof candidate.managementEnabled !== "boolean") throw new Error("malformed_owned_festival_company");
  const companyBalance = Number(candidate.companyBalance);
  if (!Number.isFinite(companyBalance) || companyBalance < 0) throw new Error("malformed_owned_festival_company");
  return {
    festivalCompanyId: candidate.festivalCompanyId, companyId: candidate.companyId, publicName: candidate.publicName, legalCompanyName: candidate.legalCompanyName, setupStatus: candidate.setupStatus,
    setupCompleted: candidate.setupCompleted, configurationComplete: candidate.configurationComplete, firstEditionExists: candidate.firstEditionExists, companyBalance, managementEnabled: candidate.managementEnabled,
  };
};

export const getOwnedFestivalCompanies = async (): Promise<OwnedFestivalCompanySummary[]> => {
  const { data, error } = await supabase.rpc("get_owned_festival_companies");
  if (error || !Array.isArray(data)) return [];
  try { return data.map(parseOwnedFestivalCompanySummary); } catch { return []; }
};
