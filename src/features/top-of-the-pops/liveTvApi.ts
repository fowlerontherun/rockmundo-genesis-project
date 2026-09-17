import { supabase } from "@/integrations/supabase/client";

export type TotpPerformanceStyleChoice = "polished" | "crowd_first" | "raw_live";

export interface TotpLiveTvEvent {
  id: string;
  invitation_id: string;
  episode_id: string;
  band_id: string;
  event_key: string;
  title: string;
  description: string;
  audience_reaction: number;
  effects: {
    reputation?: number;
    fan_sentiment?: number;
    media_intensity?: number;
    chart_effect?: number;
    cash_effect?: number;
    eligibility_effect?: number;
  };
  created_at: string;
}

export interface TotpPerformanceStyle {
  id: string;
  invitation_id: string;
  episode_id: string;
  band_id: string;
  selected_style: TotpPerformanceStyleChoice | null;
  fame_multiplier: number;
  audience_reaction: number;
  effects: {
    reputation?: number;
    fan_sentiment?: number;
    media_intensity?: number;
    chart_effect?: number;
    cash_effect?: number;
  };
  created_at: string;
  selected_at: string | null;
  applied_at: string | null;
}

export interface TotpLiveTvExtras {
  events: TotpLiveTvEvent[];
  styles: TotpPerformanceStyle[];
}

export interface TotpPerformanceStyleResult {
  status: "selected" | "already_selected";
  style: TotpPerformanceStyleChoice;
  fame_multiplier: number;
  audience_reaction: number;
  effects: TotpPerformanceStyle["effects"];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error("Choose a valid Top of the Pops item.");
  }
  return normalized;
}

export async function getMyTotpLiveTvExtras(): Promise<TotpLiveTvExtras> {
  const { data, error } = await supabase.rpc("totp_my_live_tv_extras" as any);
  if (error) throw new Error(error.message || "Could not load Top of the Pops live-TV events.");
  return (data ?? { events: [], styles: [] }) as TotpLiveTvExtras;
}

export async function chooseTotpPerformanceStyle(
  styleId: string,
  style: TotpPerformanceStyleChoice,
): Promise<TotpPerformanceStyleResult> {
  const { data, error } = await supabase.rpc("totp_choose_performance_style" as any, {
    p_style_id: uuid(styleId),
    p_style: style,
  });
  if (error) throw new Error(error.message || "Could not save the Top of the Pops performance style.");
  return data as TotpPerformanceStyleResult;
}
