import { supabase } from "@/integrations/supabase/client";

export type TotpInvitationStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "expired"
  | "checked_in"
  | "performed"
  | "missed";

export interface TotpInvitation {
  invitation_id: string;
  episode_id: string;
  episode_date: string;
  check_in_at: string;
  broadcast_at: string;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  qualifying_rank: number;
  status: TotpInvitationStatus;
  response_deadline: string;
  london_city_id: string;
  london_city_name: string;
}

export interface TotpPerformance {
  running_order: number;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  stage_key: "main_stage" | "secondary_stage" | "rock_stage" | "studio_floor" | string;
  presenter_intro: string | null;
  qualifying_rank: number;
}

export interface TotpEpisode {
  id: string;
  episode_number: number;
  episode_date: string;
  status: string;
  check_in_at: string;
  broadcast_at: string;
  presenter_key: string;
  broadcast_profile: string;
  performances: TotpPerformance[];
}

export interface TotpCheckInResult {
  status: "checked_in";
  already_checked_in?: boolean;
  members_required?: number;
  members_present?: number;
  checked_in_at?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invitationId(value: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error("Choose a valid Top of the Pops invitation.");
  }
  return normalized;
}

export async function listMyTotpInvitations(): Promise<TotpInvitation[]> {
  const { data, error } = await supabase.rpc("totp_my_invitations" as any);
  if (error) throw new Error(error.message || "Could not load Top of the Pops invitations.");
  return (data ?? []) as TotpInvitation[];
}

export async function respondToTotpInvitation(id: string, response: "accepted" | "declined"): Promise<string> {
  const normalizedId = invitationId(id);
  const { data, error } = await supabase.rpc("totp_respond_to_invitation" as any, {
    p_invitation_id: normalizedId,
    p_response: response,
  });
  if (error) throw new Error(error.message || "Could not update the Top of the Pops invitation.");
  return String(data ?? response);
}

export async function checkInToTotp(id: string): Promise<TotpCheckInResult> {
  const normalizedId = invitationId(id);
  const { data, error } = await supabase.rpc("totp_check_in" as any, {
    p_invitation_id: normalizedId,
  });
  if (error) throw new Error(error.message || "Top of the Pops studio check-in failed.");
  return (data ?? { status: "checked_in" }) as TotpCheckInResult;
}

export async function getTotpEpisode(id?: string | null): Promise<TotpEpisode | null> {
  const normalized = id ? invitationId(id) : null;
  const { data, error } = await supabase.rpc("totp_public_episode" as any, {
    p_episode_id: normalized,
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops episode.");
  return (data ?? null) as TotpEpisode | null;
}

export async function adminLockTotpRunningOrder(episodeId: string): Promise<number> {
  const normalizedId = invitationId(episodeId);
  const { data, error } = await supabase.rpc("totp_admin_lock_running_order" as any, {
    p_episode_id: normalizedId,
  });
  if (error) throw new Error(error.message || "Could not lock the Top of the Pops running order.");
  return Number(data ?? 0);
}

export function canRespondToTotpInvitation(invitation: TotpInvitation, now = new Date()): boolean {
  return invitation.status === "invited" && now.getTime() <= new Date(invitation.response_deadline).getTime();
}

export function canAttemptTotpCheckIn(invitation: TotpInvitation, now = new Date()): boolean {
  if (invitation.status !== "accepted") return false;
  const checkIn = new Date(invitation.check_in_at).getTime();
  const current = now.getTime();
  return current >= checkIn - 2 * 60 * 60 * 1000 && current <= checkIn + 45 * 60 * 1000;
}
