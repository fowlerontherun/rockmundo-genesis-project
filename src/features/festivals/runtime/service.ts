import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import {
  runtimeProjectionSchema,
  type FestivalRuntimeProjection,
} from "./model";

const runBlockerSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const festivalRunReadinessSchema = z.object({
  festivalCompanyId: z.string().uuid(),
  festivalEditionId: z.string().uuid(),
  editionVersion: z.number().int().positive(),
  editionStatus: z.string(),
  planningStatus: z.string(),
  readinessScore: z.number().int().min(0).max(100),
  scheduledFor: z.string().nullable(),
  stageCount: z.number().int().nonnegative(),
  confirmedActs: z.number().int().nonnegative(),
  npcFillEnabled: z.boolean(),
  activeLicence: z.record(z.unknown()).nullable(),
  alreadyRun: z.boolean(),
  canRun: z.boolean(),
  blockers: z.array(runBlockerSchema),
});

export type FestivalRunReadiness = z.infer<
  typeof festivalRunReadinessSchema
>;

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function getEditionRuntime(
  companyId: string,
  editionId: string,
): Promise<FestivalRuntimeProjection | null> {
  const value = await rpc<unknown>("get_festival_edition_runtime_control_room", {
    p_festival_company_id: companyId,
    p_edition_id: editionId,
  });
  return value ? runtimeProjectionSchema.parse(value) : null;
}

export async function getFestivalRunReadiness(
  companyId: string,
  editionId: string,
): Promise<FestivalRunReadiness> {
  const value = await rpc<unknown>("get_simplified_festival_run_readiness", {
    p_festival_company_id: companyId,
    p_festival_edition_id: editionId,
  });
  return festivalRunReadinessSchema.parse(value);
}

export async function runSimplifiedFestival(
  companyId: string,
  editionId: string,
  expectedEditionVersion: number,
): Promise<FestivalRuntimeProjection> {
  const value = await rpc<unknown>("run_simplified_festival_edition", {
    p_festival_company_id: companyId,
    p_festival_edition_id: editionId,
    p_expected_edition_version: expectedEditionVersion,
    p_idempotency_key: crypto.randomUUID(),
  });
  return runtimeProjectionSchema.parse(value);
}

// Retained for historical schedule-backed Festival runtimes and admin tooling.
export async function prepareEditionRuntime(
  companyId: string,
  editionId: string,
  expectedEditionVersion: number,
  expectedScheduleRevision: string,
) {
  return rpc("prepare_festival_edition_runtime", {
    p_festival_company_id: companyId,
    p_edition_id: editionId,
    p_expected_edition_version: expectedEditionVersion,
    p_expected_schedule_revision: expectedScheduleRevision,
    p_idempotency_key: crypto.randomUUID(),
  });
}

export async function transitionEditionRuntime(
  runtimeId: string,
  expectedVersion: number,
  action: string,
  reason?: string,
) {
  return rpc("transition_festival_edition_runtime", {
    p_runtime_id: runtimeId,
    p_expected_version: expectedVersion,
    p_action: action,
    p_reason: reason ?? null,
    p_idempotency_key: crypto.randomUUID(),
  });
}
