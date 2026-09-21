import { totpRpc } from "./rpc";

export type TotpRundownChartType = "streaming" | "digital_sales";

export interface TotpChartRundownEntry {
  rank: number;
  song_id: string | null;
  band_id: string | null;
  song_title: string;
  artist_name: string;
  trend: string | null;
  trend_change: number | null;
  weekly_plays: number;
}

export interface TotpChartRundown {
  episode_id: string | null;
  chart_snapshot_date: string | null;
  streaming: TotpChartRundownEntry[];
  digital_sales: TotpChartRundownEntry[];
  streaming_count: number;
  digital_sales_count: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalEpisodeId(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!UUID_PATTERN.test(normalized)) throw new Error("Choose a valid Top of the Pops episode.");
  return normalized;
}

export async function getTotpChartRundown(episodeId?: string | null): Promise<TotpChartRundown> {
  const normalized = optionalEpisodeId(episodeId);
  const { data, error } = await totpRpc<TotpChartRundown>("totp_public_chart_rundown", {
    p_episode_id: normalized,
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops chart rundown.");
  return data ?? {
    episode_id: normalized,
    chart_snapshot_date: null,
    streaming: [],
    digital_sales: [],
    streaming_count: 0,
    digital_sales_count: 0,
  };
}

export function hasTotpChartRundown(rundown?: TotpChartRundown | null): boolean {
  return !!rundown && (rundown.streaming.length > 0 || rundown.digital_sales.length > 0);
}


export async function getTotpAdminTestChartRundown(snapshotDate: string): Promise<TotpChartRundown> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
    throw new Error("Choose a valid Top of the Pops chart snapshot.");
  }
  const { data, error } = await totpRpc<TotpChartRundown>("totp_admin_test_chart_rundown", {
    p_snapshot_date: snapshotDate,
  });
  if (error) throw new Error(error.message || "Could not load the demo chart rundown.");
  return data ?? {
    episode_id: null,
    chart_snapshot_date: snapshotDate,
    streaming: [],
    digital_sales: [],
    streaming_count: 0,
    digital_sales_count: 0,
  };
}
