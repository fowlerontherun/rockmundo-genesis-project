import { totpRpc } from "./rpc";

export type TotpPostShowChoice = "press" | "fans" | "band";

export interface TotpPostShowInteraction {
  id: string;
  performance_id: string;
  invitation_id: string;
  episode_id: string;
  band_id: string;
  band_name: string;
  prompt_key: "press_line" | "fan_barrier" | "green_room_wrap" | "producer_chat" | string;
  selected_choice: TotpPostShowChoice | null;
  effects: {
    reputation?: number;
    fan_sentiment?: number;
    media_intensity?: number;
    fame_effect?: number;
    chart_effect?: number;
    cash_effect?: number;
    eligibility_effect?: number;
  };
  created_at: string;
  resolved_at: string | null;
}

export interface TotpPostShowResult {
  status: "resolved" | "already_resolved";
  choice: TotpPostShowChoice;
  effects: TotpPostShowInteraction["effects"];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) throw new Error("Choose a valid Top of the Pops interaction.");
  return normalized;
}

export async function getMyTotpPostShowInteractions(): Promise<TotpPostShowInteraction[]> {
  const { data, error } = await totpRpc<TotpPostShowInteraction[]>("totp_my_postshow_interactions");
  if (error) throw new Error(error.message || "Could not load the Top of the Pops green-room follow-up.");
  return data ?? [];
}

export async function chooseTotpPostShowInteraction(
  interactionId: string,
  choice: TotpPostShowChoice,
): Promise<TotpPostShowResult> {
  const { data, error } = await totpRpc<TotpPostShowResult>("totp_choose_postshow_interaction", {
    p_interaction_id: uuid(interactionId),
    p_choice: choice,
  });
  if (error) throw new Error(error.message || "Could not save the Top of the Pops post-show response.");
  if (!data) throw new Error("Top of the Pops returned no post-show response.");
  return data;
}
