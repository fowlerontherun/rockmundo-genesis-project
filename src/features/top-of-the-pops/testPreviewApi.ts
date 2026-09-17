import { totpRpc } from "./rpc";

export interface TotpTestPreviewSideEffects {
  invitations: boolean;
  notifications: boolean;
  rewards: boolean;
  history: boolean;
  chart_changes: boolean;
}

export interface TotpTestPreviewBandMember {
  profile_id: string | null;
  display_name: string;
  role: string;
  instrument_role: string | null;
  vocal_role: string | null;
}

export interface TotpTestPreviewPerformance {
  running_order: number;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  genre: string;
  qualifying_rank: number;
  qualifying_chart: "streaming" | "digital_sales" | "both" | string;
  selection_bucket: "top10" | "11_20" | "21_40" | string;
  stage_key: "main_stage" | "stage_b" | "rock_stage" | "studio_floor" | string;
  presenter_intro: string;
  members: TotpTestPreviewBandMember[];
}

export interface TotpAdminTestPreview {
  mode: "dry_run";
  safe: boolean;
  chart_snapshot_date: string;
  generated_at: string;
  seed: string;
  max_performances: number;
  eligible_count: number;
  selected_count: number;
  previous_episode_id: string | null;
  side_effects: TotpTestPreviewSideEffects;
  performances: TotpTestPreviewPerformance[];
}

export function isTotpTestPreviewSafe(preview: TotpAdminTestPreview): boolean {
  return preview.mode === "dry_run"
    && preview.safe === true
    && Object.values(preview.side_effects).every((enabled) => enabled === false);
}

export async function adminPreviewTotpTestEpisode(seed = "admin-test", maxPerformances = 10): Promise<TotpAdminTestPreview> {
  const normalizedSeed = seed.trim().slice(0, 80) || "admin-test";
  const normalizedMax = Math.max(1, Math.min(20, Math.round(maxPerformances)));
  const { data, error } = await totpRpc<TotpAdminTestPreview>("totp_admin_test_episode_preview", {
    p_seed: normalizedSeed,
    p_max_performances: normalizedMax,
  });

  if (error) throw new Error(error.message || "Could not build the Top of the Pops test preview.");
  if (!data) throw new Error("Top of the Pops returned no test preview.");
  if (!isTotpTestPreviewSafe(data)) throw new Error("Top of the Pops test preview failed its safety contract.");

  const bandIds = [...new Set(data.performances.map((performance) => performance.band_id))];
  const { data: lineupData, error: lineupError } = await totpRpc<Record<string, TotpTestPreviewBandMember[]>>(
    "totp_admin_test_band_lineups",
    { p_band_ids: bandIds },
  );
  if (lineupError) throw new Error(lineupError.message || "Could not load the Top of the Pops demo band lineups.");

  return {
    ...data,
    performances: data.performances.map((performance) => ({
      ...performance,
      members: lineupData?.[performance.band_id] ?? [],
    })),
  };
}
