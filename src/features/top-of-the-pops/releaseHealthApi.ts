import { totpRpc } from "./rpc";

export interface TotpReleaseHealth {
  healthy: boolean;
  chart: {
    latest_date: string | null;
    fresh: boolean;
    streaming_rows: number;
    digital_rows: number;
  };
  next_episode: {
    id: string;
    episode_number: number;
    episode_date: string;
    status: string;
    check_in_at: string;
    broadcast_at: string;
    invitations: number;
  } | null;
  crons: {
    prepare: boolean;
    uk_chart_refresh: boolean;
    broadcast_cycle: boolean;
  };
  invalid_totp_notifications: number;
  checked_at: string;
}

export async function getTotpReleaseHealth(): Promise<TotpReleaseHealth> {
  const { data, error } = await totpRpc<"totp_release_health", TotpReleaseHealth>("totp_release_health");
  if (error) throw new Error(error.message || "Could not check Top of the Pops production health.");
  if (!data) throw new Error("Top of the Pops returned no production health report.");
  return data;
}

export function totpHealthFailures(health: TotpReleaseHealth): string[] {
  const failures: string[] = [];
  if (!health.chart.fresh) failures.push("UK chart snapshot is stale");
  if (!health.crons.prepare) failures.push("episode preparation is stopped");
  if (!health.crons.uk_chart_refresh) failures.push("chart refresh is stopped");
  if (!health.crons.broadcast_cycle) failures.push("broadcast automation is stopped");
  if (!health.next_episode) failures.push("no upcoming episode is scheduled");
  if (health.invalid_totp_notifications > 0) failures.push(`${health.invalid_totp_notifications} notification contract issue${health.invalid_totp_notifications === 1 ? "" : "s"}`);
  return failures;
}