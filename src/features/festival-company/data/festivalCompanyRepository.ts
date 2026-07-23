import { supabase } from "@/integrations/supabase/client";
import type { FoundFestivalCompanyInput, FoundFestivalCompanyResult } from "../domain/festivalCompany";
import type { FestivalCompanySetupState } from "../domain/festivalSetup";
import { disabledFestivalCompanyCapabilities } from "../domain/festivalCapabilities";

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
