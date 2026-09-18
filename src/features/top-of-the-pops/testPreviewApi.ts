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

export interface TotpTestSongAudio {
  audio_url: string | null;
  extended_audio_url: string | null;
  audio_generation_status: string | null;
  duration_seconds: number | null;
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
  members?: TotpTestPreviewBandMember[];
  audio?: TotpTestSongAudio | null;
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

function energeticDemoIntro(performance: TotpTestPreviewPerformance): string {
  return `Come on, studio — make some noise! At number ${performance.qualifying_rank} this week, here are ${performance.band_name} with ${performance.song_title}!`;
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
  const songIds = [...new Set(data.performances.map((performance) => performance.song_id))];
  const [lineups, audio] = await Promise.all([
    totpRpc<Record<string, TotpTestPreviewBandMember[]>>("totp_admin_test_band_lineups", {
      p_band_ids: bandIds,
    }),
    totpRpc<Record<string, TotpTestSongAudio>>("totp_admin_test_song_audio", {
      p_song_ids: songIds,
    }),
  ]);
  if (lineups.error) throw new Error(lineups.error.message || "Could not load the Top of the Pops demo band lineups.");
  if (audio.error) throw new Error(audio.error.message || "Could not load the Top of the Pops demo song audio.");

  return {
    ...data,
    performances: data.performances.map((performance) => ({
      ...performance,
      presenter_intro: energeticDemoIntro(performance),
      members: lineups.data?.[performance.band_id] ?? [],
      audio: audio.data?.[performance.song_id] ?? null,
    })),
  };
}
