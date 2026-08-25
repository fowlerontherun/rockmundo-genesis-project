import { supabase } from "@/integrations/supabase/client";
import {
  normalizeFestivalLocalStart,
  parseFestivalDayPlan,
  parseFestivalPlanPreview,
  parseFestivalStagePlanPreview,
  parseFestivalStageSchedule,
  type CreateFestivalPlanItemInput,
  type FestivalDayPlan,
  type FestivalPlanMutationResult,
  type FestivalPlanPreview,
  type FestivalStagePlanPreview,
  type FestivalStageSchedule,
  type PreviewFestivalPlanItemInput,
} from "./festivalDayPlanner";
import {
  parseFestivalActivityResolution,
  parseFestivalConditions,
  type FestivalActivityResolution,
  type FestivalConditions,
} from "./festivalConditions";

type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const plannerRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseMutationResult = (value: unknown): FestivalPlanMutationResult => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("malformed_festival_plan_mutation");
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    !UUID_RE.test(candidate.id) ||
    typeof candidate.status !== "string" ||
    !["planned", "completed", "missed", "cancelled"].includes(candidate.status)
  ) {
    throw new Error("malformed_festival_plan_mutation");
  }

  if (candidate.startsAt !== undefined && typeof candidate.startsAt !== "string") {
    throw new Error("malformed_festival_plan_mutation");
  }
  if (candidate.endsAt !== undefined && typeof candidate.endsAt !== "string") {
    throw new Error("malformed_festival_plan_mutation");
  }
  if (candidate.duplicate !== undefined && typeof candidate.duplicate !== "boolean") {
    throw new Error("malformed_festival_plan_mutation");
  }
  if (candidate.alreadyCancelled !== undefined && typeof candidate.alreadyCancelled !== "boolean") {
    throw new Error("malformed_festival_plan_mutation");
  }

  return candidate as unknown as FestivalPlanMutationResult;
};

export const getMyFestivalDayPlan = async (attendanceId: string): Promise<FestivalDayPlan> => {
  const { data, error } = await plannerRpc("get_my_festival_day_plan", {
    p_attendance_id: attendanceId,
  });
  if (error) throw new Error(error.message || "festival_day_plan_unavailable");
  return parseFestivalDayPlan(data);
};

export const previewFestivalDayPlanItem = async (
  input: PreviewFestivalPlanItemInput,
): Promise<FestivalPlanPreview> => {
  const { data, error } = await plannerRpc("preview_festival_day_plan_item", {
    p_attendance_id: input.attendanceId,
    p_festival_date: input.festivalDate,
    p_local_start: normalizeFestivalLocalStart(input.localStart),
    p_duration_minutes: input.durationMinutes,
    p_activity_type: input.activityType,
  });
  if (error) throw new Error(error.message || "festival_day_plan_preview_failed");
  return parseFestivalPlanPreview(data);
};

export const createFestivalDayPlanItem = async (
  input: CreateFestivalPlanItemInput,
): Promise<FestivalPlanMutationResult> => {
  const { data, error } = await plannerRpc("create_festival_day_plan_item", {
    p_attendance_id: input.attendanceId,
    p_festival_date: input.festivalDate,
    p_local_start: normalizeFestivalLocalStart(input.localStart),
    p_duration_minutes: input.durationMinutes,
    p_activity_type: input.activityType,
    p_title: input.title,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message || "festival_day_plan_create_failed");
  return parseMutationResult(data);
};

export const cancelFestivalDayPlanItem = async (itemId: string): Promise<FestivalPlanMutationResult> => {
  const { data, error } = await plannerRpc("cancel_festival_day_plan_item", {
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message || "festival_day_plan_cancel_failed");
  return parseMutationResult(data);
};

export const getMyFestivalStageSchedule = async (attendanceId: string): Promise<FestivalStageSchedule> => {
  const { data, error } = await plannerRpc("get_my_festival_stage_schedule", {
    p_attendance_id: attendanceId,
  });
  if (error) throw new Error(error.message || "festival_stage_schedule_unavailable");
  return parseFestivalStageSchedule(data);
};

export const previewFestivalStagePlanItem = async (
  attendanceId: string,
  scheduleItemId: string,
): Promise<FestivalStagePlanPreview> => {
  const { data, error } = await plannerRpc("preview_festival_stage_plan_item", {
    p_attendance_id: attendanceId,
    p_schedule_item_id: scheduleItemId,
  });
  if (error) throw new Error(error.message || "festival_stage_plan_preview_failed");
  return parseFestivalStagePlanPreview(data);
};

export const addFestivalStagePerformanceToDayPlan = async (
  attendanceId: string,
  scheduleItemId: string,
  idempotencyKey: string,
): Promise<FestivalPlanMutationResult> => {
  const { data, error } = await plannerRpc("add_festival_stage_performance_to_day_plan", {
    p_attendance_id: attendanceId,
    p_schedule_item_id: scheduleItemId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message || "festival_stage_plan_add_failed");
  return parseMutationResult(data);
};

export const getMyFestivalConditions = async (attendanceId: string): Promise<FestivalConditions> => {
  const { data, error } = await plannerRpc("get_my_festival_conditions", {
    p_attendance_id: attendanceId,
  });
  if (error) throw new Error(error.message || "festival_conditions_unavailable");
  return parseFestivalConditions(data);
};

export const resolveFestivalPlanActivity = async (planItemId: string): Promise<FestivalActivityResolution> => {
  const { data, error } = await plannerRpc("resolve_festival_plan_activity", {
    p_plan_item_id: planItemId,
  });
  if (error) throw new Error(error.message || "festival_activity_resolution_failed");
  return parseFestivalActivityResolution(data);
};
