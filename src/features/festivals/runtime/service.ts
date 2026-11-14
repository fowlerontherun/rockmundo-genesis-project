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
  confirmedPlayerActs: z.number().int().nonnegative().optional(),
  npcFillEnabled: z.boolean(),
  activeLicence: z.record(z.unknown()).nullable(),
  licensedStageLimit: z.number().int().positive().nullable().optional(),
  licensedActsPerDay: z.number().int().positive().nullable().optional(),
  alreadyRun: z.boolean(),
  canRun: z.boolean(),
  blockers: z.array(runBlockerSchema),
});

export type FestivalRunReadiness = z.infer<
  typeof festivalRunReadinessSchema
>;

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const call = supabase.rpc.bind(supabase) as (
    rpcName: string,
    rpcArgs: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await call(name, args);
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

/** Only confirmation evidence from the canonical annual-edition runtime. */
const canonicalStageStatusSchema = z.enum([
  "ready", "starting", "live", "delayed", "completed", "cancelled",
]);
export const canonicalStageControlSchema = z.object({
  runtimeId: z.string().uuid(),
  editionId: z.string().uuid(),
  runtimeVersion: z.number().int(),
  runtimeState: z.string(),
  festivalDate: z.string(),
  items: z.array(z.object({
    stageId: z.string().uuid(),
    stageName: z.string(),
    scheduleItemId: z.string().uuid(),
    artistName: z.string(),
    festivalDate: z.string(),
    status: canonicalStageStatusSchema.nullable(),
    observedAt: z.string().nullable(),
  })),
});
export type CanonicalStageControl = z.infer<typeof canonicalStageControlSchema>;
export type CanonicalStageStatus = z.infer<typeof canonicalStageStatusSchema>;

export function getCanonicalStageControl(runtimeId: string): Promise<CanonicalStageControl> {
  return rpc<unknown>("get_canonical_festival_stage_control", {
    p_runtime_id: runtimeId,
  }).then(value => canonicalStageControlSchema.parse(value));
}

export async function confirmCanonicalStageAction(input: {
  runtimeId: string;
  stageId: string;
  scheduleItemId: string;
  status: CanonicalStageStatus;
  expectedRuntimeVersion: number;
  idempotencyKey: string;
}): Promise<void> {
  await rpc<unknown>("record_canonical_festival_stage_action", {
    p_runtime_id: input.runtimeId,
    p_stage_id: input.stageId,
    p_schedule_item_id: input.scheduleItemId,
    p_status: input.status,
    p_idempotency_key: input.idempotencyKey,
    p_expected_runtime_version: input.expectedRuntimeVersion,
  });
}

export async function startCanonicalFestivalLiveDay(input: {
  companyId: string;
  editionId: string;
  editionVersion: number;
  requestId: string;
}): Promise<FestivalRuntimeProjection> {
  const value = await rpc<unknown>("start_canonical_festival_live_day", {
    p_festival_company_id: input.companyId,
    p_festival_edition_id: input.editionId,
    p_expected_edition_version: input.editionVersion,
    p_idempotency_key: input.requestId,
  });
  return runtimeProjectionSchema.parse(value);
}

export type LiveDayAction = "start_live" | "pause" | "resume" | "close" | "finish" | "cancel" | "tick";

export interface LiveDayRequest {
  runtimeId: string;
  version: number;
  requestId: string;
  action: LiveDayAction;
  arrivals?: number;
  departures?: number;
  stageCounts?: Record<string, number>;
  otherZones?: number;
}

export async function advanceCanonicalFestivalLiveDay(input: LiveDayRequest): Promise<FestivalRuntimeProjection> {
  const value = await rpc<unknown>("advance_canonical_festival_live_day", {
    p_runtime_id: input.runtimeId,
    p_expected_version: input.version,
    p_request_id: input.requestId,
    p_action: input.action,
    p_arrivals: input.arrivals ?? 0,
    p_departures: input.departures ?? 0,
    p_stage_counts: input.stageCounts ?? {},
    p_other_zones: input.otherZones ?? 0,
  });
  return runtimeProjectionSchema.parse(value);
}

export async function getCanonicalLiveDayAvailability(companyId: string, editionId: string) {
  const value = await rpc<unknown>("get_canonical_festival_live_day_availability", {
    p_company_id: companyId,
    p_edition_id: editionId,
  });
  return z.object({ canOpen: z.boolean(), managed: z.boolean(), canAllocate: z.boolean() }).parse(value);
}
