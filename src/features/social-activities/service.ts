import { supabase } from "@/integrations/supabase/client";
import type { CostPayer, SocialActivityType } from "./catalog";

export interface SocialActivityRow { id: string; activity_type: SocialActivityType; host_player_id: string; title: string; description: string | null; status: string; start_at: string; end_at: string; duration_minutes: number; cost_payer: CostPayer; estimated_cost: number; visibility: string; }
export interface CreateSocialActivityInput { activityType: SocialActivityType; participantIds: string[]; startAt: string; durationMinutes: number; cityId?: string | null; locationId?: string | null; bandId?: string | null; costPayer: CostPayer; title?: string | null; note?: string | null; visibility?: string; }
export async function createSocialActivity(input: CreateSocialActivityInput): Promise<SocialActivityRow> {
  const { data, error } = await (supabase as any).rpc("create_social_activity", { p_activity_type: input.activityType, p_participant_ids: input.participantIds, p_start_at: input.startAt, p_duration_minutes: input.durationMinutes, p_city_id: input.cityId ?? null, p_location_id: input.locationId ?? null, p_band_id: input.bandId ?? null, p_cost_payer: input.costPayer, p_title: input.title ?? null, p_note: input.note ?? null, p_visibility: input.visibility ?? "participants_only" });
  if (error) throw new Error(error.message || "Unable to create social activity");
  return data as SocialActivityRow;
}
export async function respondSocialActivity(activityId: string, response: "accepted" | "declined" | "cancelled") {
  const { data, error } = await (supabase as any).rpc("respond_social_activity_invitation", { p_activity_id: activityId, p_response: response });
  if (error) throw new Error(error.message || "Unable to respond to social activity");
  return data;
}
export async function completeSocialActivity(activityId: string) {
  const { data, error } = await (supabase as any).rpc("complete_social_activity", { p_activity_id: activityId });
  if (error) throw new Error(error.message || "Unable to complete social activity");
  return data;
}
