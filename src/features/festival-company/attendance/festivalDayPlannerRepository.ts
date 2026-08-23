import { supabase } from "@/integrations/supabase/client";
import {
  normalizeFestivalLocalStart,
  parseFestivalDayPlan,
  type CreateFestivalPlanItemInput,
  type FestivalDayPlan,
  type FestivalPlanMutationResult,
} from "./festivalDayPlanner";

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
    !["planned", "missed", "cancelled"].includes(candidate.status)
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
