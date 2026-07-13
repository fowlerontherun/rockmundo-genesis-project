import { supabase } from "@/integrations/supabase/client";

export interface SocialPermissions {
  can_view_profile: boolean;
  can_send_friend_request: boolean;
  can_message: boolean;
  can_invite_to_band: boolean;
  can_invite_to_activity: boolean;
  can_offer_job: boolean;
  can_send_money: boolean;
  can_send_item: boolean;
  can_report: boolean;
  is_blocked_by_viewer: boolean;
  is_interaction_restricted: boolean;
  message: string | null;
}

export async function getSocialPermissions(targetProfileId: string): Promise<SocialPermissions> {
  const { data, error } = await (supabase as any).rpc("get_social_permissions", { target_profile_id: targetProfileId });
  if (error) throw new Error("This player is unavailable.");
  return data as SocialPermissions;
}

export function canInteractSocially(permissions?: SocialPermissions | null) {
  return !!permissions && !permissions.is_interaction_restricted;
}
