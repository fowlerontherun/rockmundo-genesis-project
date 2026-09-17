import { totpRpc } from "./rpc";

export interface TotpStudioReadinessMember {
  profile_id: string;
  display_name: string;
  is_in_london: boolean;
  is_traveling: boolean;
  ready: boolean;
}

export interface TotpStudioReadiness {
  invitation_id: string;
  status: string;
  response_deadline: string;
  check_in_at: string;
  check_in_opens_at: string;
  check_in_closes_at: string;
  broadcast_at: string;
  members_required: number;
  members_present: number;
  all_ready: boolean;
  members: TotpStudioReadinessMember[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getTotpStudioReadiness(invitationId: string): Promise<TotpStudioReadiness> {
  const normalizedId = invitationId?.trim();
  if (!normalizedId || !UUID_PATTERN.test(normalizedId)) {
    throw new Error("Choose a valid Top of the Pops invitation.");
  }

  const { data, error } = await totpRpc<TotpStudioReadiness>("totp_studio_readiness", {
    p_invitation_id: normalizedId,
  });

  if (error) throw new Error(error.message || "Could not load the Top of the Pops studio call sheet.");
  if (!data) throw new Error("Top of the Pops returned no studio readiness data.");
  return data;
}
