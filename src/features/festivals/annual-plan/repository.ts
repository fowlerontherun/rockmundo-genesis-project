import { supabase } from "@/integrations/supabase/client";
import { getFestivalBranding } from "@/features/festival-company/data/festivalBrandingRepository";
import type { FestivalBranding } from "@/features/festival-company/domain/festivalBranding";
import {
  festivalAnnualPlanSchema,
  type FestivalAnnualPlan,
  type FestivalAnnualPlanDraft,
} from "./model";

type FestivalRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const festivalRpc = supabase.rpc.bind(supabase) as unknown as FestivalRpc;

export const festivalAnnualPlanQueryKey = (
  festivalCompanyId: string,
  festivalEditionId: string,
) => ["festival-annual-plan", festivalCompanyId, festivalEditionId] as const;

export async function getFestivalAnnualPlan(
  festivalCompanyId: string,
  festivalEditionId: string,
): Promise<FestivalAnnualPlan> {
  const { data, error } = await festivalRpc(
    "get_festival_edition_annual_plan",
    {
      p_festival_company_id: festivalCompanyId,
      p_festival_edition_id: festivalEditionId,
    },
  );

  if (error) throw new Error(error.message ?? "festival_annual_plan_unavailable");
  const parsed = festivalAnnualPlanSchema.safeParse(data);
  if (!parsed.success) throw new Error("malformed_festival_annual_plan_result");
  return { ...parsed.data, branding: await getFestivalBranding(festivalEditionId) };
}

export async function saveFestivalAnnualPlan(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  expectedVersion: number;
  plan: FestivalAnnualPlanDraft;
  idempotencyKey: string;
  branding?: FestivalBranding;
}): Promise<FestivalAnnualPlan> {
  const { data, error } = await festivalRpc(
    input.branding ? "save_festival_edition_wizard" : "save_festival_edition_annual_plan",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_expected_version: input.expectedVersion,
      p_plan: input.plan,
      p_idempotency_key: input.idempotencyKey,
      ...(input.branding ? { p_branding: input.branding } : {}),
    },
  );

  if (error) throw new Error(error.message ?? "festival_annual_plan_save_failed");
  const parsed = festivalAnnualPlanSchema.safeParse(data);
  if (!parsed.success) throw new Error("malformed_festival_annual_plan_result");
  return parsed.data;
}
