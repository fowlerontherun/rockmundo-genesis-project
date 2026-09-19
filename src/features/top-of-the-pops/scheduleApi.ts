import { supabase } from "@/integrations/supabase/client";
import { totpRpc } from "./rpc";

export interface TotpScheduleEpisode {
  id: string;
  episode_number: number;
  episode_date: string;
  status: string;
  show_variant: string;
  presenter_key: string;
  broadcast_profile: string | null;
  broadcast_at: string;
  check_in_at: string;
  chart_snapshot_date: string;
  max_performances: number;
  city_id: string | null;
  city_name: string | null;
  performance_count: number;
  invitation_count: number;
  checked_in_count: number;
  has_manifest: boolean;
  has_plan: boolean;
}

export interface TotpSchedule {
  week_start: string;
  week_end: string;
  weeks: number;
  episodes: TotpScheduleEpisode[];
}

export interface TotpPlannedSegment {
  id: string;
  kind: string;
  title: string;
  durationSeconds: number;
  notes?: string;
}

export interface TotpEpisodePlan {
  episode_id: string;
  theme: string | null;
  opening_link: string | null;
  closing_link: string | null;
  segments: TotpPlannedSegment[];
  notes: string | null;
  updated_at?: string;
}

export interface TotpEpisodeDraft {
  episodeId?: string | null;
  episodeDate: string;
  broadcastAt?: string | null;
  checkInAt?: string | null;
  chartSnapshotDate?: string | null;
  cityId?: string | null;
  presenterKey?: string | null;
  showVariant?: string | null;
  maxPerformances?: number | null;
}

export const TOTP_SEGMENT_KINDS = [
  "presenter_link",
  "performance",
  "interview",
  "chart_rundown",
  "guest_slot",
  "video_playout",
  "credits",
] as const;

export function totpSegmentKindLabel(kind: string): string {
  switch (kind) {
    case "presenter_link":
      return "Presenter link";
    case "performance":
      return "Performance";
    case "interview":
      return "Interview";
    case "chart_rundown":
      return "Chart rundown";
    case "guest_slot":
      return "Guest slot";
    case "video_playout":
      return "Video playout";
    case "credits":
      return "Credits";
    default:
      return kind;
  }
}

export function totpStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "inviting":
      return "Booking acts";
    case "locked":
      return "Running order locked";
    case "recording":
      return "Recording";
    case "broadcast":
      return "Broadcast";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function totpEpisodeIsEditable(status: string): boolean {
  return status !== "broadcast" && status !== "completed";
}

export async function getTotpSchedule(from: string, weeks: number): Promise<TotpSchedule> {
  const { data, error } = await totpRpc<TotpSchedule>("totp_admin_broadcast_schedule", {
    p_from: from,
    p_weeks: weeks,
  });
  if (error) throw new Error(error.message || "Could not load the broadcast schedule.");
  return data ?? { week_start: from, week_end: from, weeks, episodes: [] };
}

export async function saveTotpEpisodeDraft(draft: TotpEpisodeDraft): Promise<string> {
  const { data, error } = await totpRpc<string>("totp_admin_upsert_episode", {
    p_episode_id: draft.episodeId ?? null,
    p_episode_date: draft.episodeDate,
    p_broadcast_at: draft.broadcastAt ?? null,
    p_check_in_at: draft.checkInAt ?? null,
    p_chart_snapshot_date: draft.chartSnapshotDate ?? null,
    p_city_id: draft.cityId ?? null,
    p_presenter_key: draft.presenterKey ?? null,
    p_show_variant: draft.showVariant ?? null,
    p_max_performances: draft.maxPerformances ?? null,
  });
  if (error) throw new Error(error.message || "Could not save the episode.");
  return data as string;
}

export async function cancelTotpEpisode(episodeId: string): Promise<void> {
  const { error } = await totpRpc<boolean>("totp_admin_cancel_episode", { p_episode_id: episodeId });
  if (error) throw new Error(error.message || "Could not cancel the episode.");
}

export async function getTotpEpisodePlan(episodeId: string): Promise<TotpEpisodePlan | null> {
  const { data, error } = await totpRpc<TotpEpisodePlan | null>("totp_episode_plan", {
    p_episode_id: episodeId,
  });
  if (error) throw new Error(error.message || "Could not load the episode plan.");
  if (!data) return null;
  return { ...data, segments: Array.isArray(data.segments) ? data.segments : [] };
}

export async function saveTotpEpisodePlan(
  episodeId: string,
  plan: Omit<TotpEpisodePlan, "episode_id">,
): Promise<TotpEpisodePlan> {
  const { data, error } = await totpRpc<TotpEpisodePlan>("totp_admin_save_episode_plan", {
    p_episode_id: episodeId,
    p_plan: {
      theme: plan.theme ?? null,
      opening_link: plan.opening_link ?? null,
      closing_link: plan.closing_link ?? null,
      notes: plan.notes ?? null,
      segments: plan.segments ?? [],
    },
  });
  if (error) throw new Error(error.message || "Could not save the episode plan.");
  return data as TotpEpisodePlan;
}

export interface TotpCityOption {
  id: string;
  name: string;
}

export async function getTotpCityOptions(): Promise<TotpCityOption[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, name")
    .order("name")
    .limit(500);
  if (error) throw new Error(error.message || "Could not load cities.");
  return (data ?? []) as TotpCityOption[];
}
