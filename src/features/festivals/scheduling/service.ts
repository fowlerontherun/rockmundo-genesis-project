import { supabase } from "@/integrations/supabase/client";
import { workspaceSchema, type FestivalScheduleWorkspaceData } from "./model";

const rpc = async <T>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data as T;
};
export async function fetchFestivalScheduleWorkspace(editionId: string): Promise<FestivalScheduleWorkspaceData> {
  return workspaceSchema.parse(await rpc("festival_edition_schedule_workspace", { p_edition_id: editionId }));
}
export const configureStageHours = (input: { editionId: string; stageId: string; date: string; openingTime: string; curfew: string; shutdownBufferMinutes?: number; changeoverMinutes?: number }) => rpc("festival_schedule_configure_stage_hours", { p_edition_id: input.editionId, p_stage_id: input.stageId, p_festival_date: input.date, p_opening_time: input.openingTime, p_curfew: input.curfew, p_shutdown_buffer_minutes: input.shutdownBufferMinutes ?? 0, p_changeover_minutes: input.changeoverMinutes ?? 30, p_idempotency_key: `hours:${input.stageId}:${input.date}` });
export const upsertScheduleItem = (input: { editionId: string; revisionId: string; item: Record<string, unknown>; expectedVersion?: number; idempotencyKey?: string }) => rpc("festival_schedule_upsert_item", { p_edition_id: input.editionId, p_revision_id: input.revisionId, p_item: input.item, p_expected_version: input.expectedVersion ?? null, p_idempotency_key: input.idempotencyKey ?? `item:${input.revisionId}:${Date.now()}` });
export const previewScheduleTemplate = (input: { editionId: string; stageId: string; date: string; template: string; openingTime: string; curfew: string }) => rpc<any>("festival_schedule_preview_template", { p_edition_id: input.editionId, p_stage_id: input.stageId, p_festival_date: input.date, p_template: input.template, p_opening_time: input.openingTime, p_curfew: input.curfew });
export const applyScheduleTemplate = (input: { editionId: string; revisionId: string; stageId: string; date: string; template: string; openingTime: string; curfew: string; confirmOverwrite?: boolean }) => rpc("festival_schedule_apply_template", { p_edition_id: input.editionId, p_revision_id: input.revisionId, p_stage_id: input.stageId, p_festival_date: input.date, p_template: input.template, p_opening_time: input.openingTime, p_curfew: input.curfew, p_confirm_overwrite: input.confirmOverwrite ?? false, p_idempotency_key: `template:${input.revisionId}:${input.stageId}:${input.date}:${input.template}` });
export const publishSchedule = (input: { editionId: string; revisionId: string; acknowledgeWarnings?: boolean }) => rpc("festival_schedule_publish", { p_edition_id: input.editionId, p_revision_id: input.revisionId, p_acknowledge_warnings: input.acknowledgeWarnings ?? false, p_idempotency_key: `publish:${input.revisionId}` });
