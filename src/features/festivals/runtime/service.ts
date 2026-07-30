import { supabase } from "@/integrations/supabase/client";
import { runtimeProjectionSchema, type FestivalRuntimeProjection } from "./model";

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function getEditionRuntime(companyId: string, editionId: string): Promise<FestivalRuntimeProjection | null> {
  const value = await rpc<unknown>("get_festival_edition_runtime_control_room", { p_festival_company_id: companyId, p_edition_id: editionId });
  return value ? runtimeProjectionSchema.parse(value) : null;
}
export async function prepareEditionRuntime(companyId: string, editionId: string, expectedEditionVersion: number, expectedScheduleRevision: string) {
  return rpc("prepare_festival_edition_runtime", { p_festival_company_id: companyId, p_edition_id: editionId, p_expected_edition_version: expectedEditionVersion, p_expected_schedule_revision: expectedScheduleRevision, p_idempotency_key: crypto.randomUUID() });
}
export async function transitionEditionRuntime(runtimeId: string, expectedVersion: number, action: string, reason?: string) {
  return rpc("transition_festival_edition_runtime", { p_runtime_id: runtimeId, p_expected_version: expectedVersion, p_action: action, p_reason: reason ?? null, p_idempotency_key: crypto.randomUUID() });
}
