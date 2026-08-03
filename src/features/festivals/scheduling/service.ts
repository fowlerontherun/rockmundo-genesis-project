import { supabase } from "@/integrations/supabase/client";
import {
  workspaceSchema,
  type FestivalScheduleWorkspaceData,
} from "./model";

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};

const rpcClient = supabase as unknown as RpcClient;

const rpc = async <T>(functionName: string, args: Record<string, unknown>) => {
  const { data, error } = await rpcClient.rpc(functionName, args);
  if (error) throw error;
  return data as T;
};

const operationKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;

export async function fetchFestivalScheduleWorkspace(
  editionId: string,
): Promise<FestivalScheduleWorkspaceData> {
  return workspaceSchema.parse(
    await rpc("festival_edition_schedule_workspace", {
      p_edition_id: editionId,
    }),
  );
}

export const configureStageHours = (input: {
  editionId: string;
  stageId: string;
  date: string;
  openingTime: string;
  curfew: string;
  shutdownBufferMinutes?: number;
  changeoverMinutes?: number;
}) =>
  rpc("festival_schedule_configure_stage_hours", {
    p_edition_id: input.editionId,
    p_stage_id: input.stageId,
    p_festival_date: input.date,
    p_opening_time: input.openingTime,
    p_curfew: input.curfew,
    p_shutdown_buffer_minutes: input.shutdownBufferMinutes ?? 0,
    p_changeover_minutes: input.changeoverMinutes ?? 30,
    p_idempotency_key: operationKey(`hours:${input.stageId}:${input.date}`),
  });

export const upsertScheduleItem = (input: {
  editionId: string;
  revisionId: string;
  item: Record<string, unknown>;
  expectedVersion?: number;
  idempotencyKey?: string;
}) => {
  const rawDuration = Number(input.item.durationMinutes);
  const item = Number.isFinite(rawDuration)
    ? {
        ...input.item,
        durationMinutes: Math.max(1, Math.trunc(rawDuration)),
      }
    : input.item;

  return rpc("festival_schedule_upsert_item", {
    p_edition_id: input.editionId,
    p_revision_id: input.revisionId,
    p_item: item,
    p_expected_version: input.expectedVersion ?? null,
    p_idempotency_key:
      input.idempotencyKey ?? operationKey(`item:${input.revisionId}`),
  });
};

export const previewScheduleTemplate = (input: {
  editionId: string;
  stageId: string;
  date: string;
  template: string;
  openingTime: string;
  curfew: string;
}) =>
  rpc<Record<string, unknown>>("festival_schedule_preview_template", {
    p_edition_id: input.editionId,
    p_stage_id: input.stageId,
    p_festival_date: input.date,
    p_template: input.template,
    p_opening_time: input.openingTime,
    p_curfew: input.curfew,
  });

export const applyScheduleTemplate = (input: {
  editionId: string;
  revisionId: string;
  stageId: string;
  date: string;
  template: string;
  openingTime: string;
  curfew: string;
  confirmOverwrite?: boolean;
}) =>
  rpc("festival_schedule_apply_template", {
    p_edition_id: input.editionId,
    p_revision_id: input.revisionId,
    p_stage_id: input.stageId,
    p_festival_date: input.date,
    p_template: input.template,
    p_opening_time: input.openingTime,
    p_curfew: input.curfew,
    p_confirm_overwrite: input.confirmOverwrite ?? false,
    p_idempotency_key: operationKey(
      `template:${input.revisionId}:${input.stageId}:${input.date}:${input.template}`,
    ),
  });

export const publishSchedule = (input: {
  editionId: string;
  revisionId: string;
  acknowledgeWarnings?: boolean;
}) =>
  rpc("festival_schedule_publish", {
    p_edition_id: input.editionId,
    p_revision_id: input.revisionId,
    p_acknowledge_warnings: input.acknowledgeWarnings ?? false,
    p_idempotency_key: operationKey(`publish:${input.revisionId}`),
  });

export const lockSchedule = (input: {
  editionId: string;
  revisionId: string;
  reason: string;
}) =>
  rpc("festival_schedule_lock", {
    p_edition_id: input.editionId,
    p_revision_id: input.revisionId,
    p_reason: input.reason,
    p_idempotency_key: operationKey(`lock:${input.revisionId}`),
  });

export const reopenSchedule = (input: {
  editionId: string;
  revisionId: string;
  reason: string;
}) =>
  rpc("festival_schedule_reopen", {
    p_edition_id: input.editionId,
    p_revision_id: input.revisionId,
    p_reason: input.reason,
    p_idempotency_key: operationKey(`reopen:${input.revisionId}`),
  });

export const discardDraftSchedule = (input: {
  editionId: string;
  revisionId: string;
  reason?: string;
}) =>
  rpc("festival_schedule_discard_draft", {
    p_edition_id: input.editionId,
    p_revision_id: input.revisionId,
    p_reason: input.reason ?? null,
    p_idempotency_key: operationKey(`discard:${input.revisionId}`),
  });
