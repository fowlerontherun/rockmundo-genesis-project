import { describe, expect, it } from "vitest";
import { totpHealthFailures, type TotpReleaseHealth } from "./releaseHealthApi";

const healthy: TotpReleaseHealth = {
  healthy: true,
  chart: { latest_date: "2026-09-18", fresh: true, streaming_rows: 40, digital_rows: 40 },
  next_episode: { id: "episode", episode_number: 2, episode_date: "2026-10-01", status: "inviting", check_in_at: "2026-10-01T17:00:00Z", broadcast_at: "2026-10-01T19:00:00Z", invitations: 8 },
  crons: { prepare: true, uk_chart_refresh: true, broadcast_cycle: true },
  invalid_totp_notifications: 0,
  checked_at: "2026-09-19T08:46:00Z",
};

describe("totpHealthFailures", () => {
  it("returns no blockers for a healthy production report", () => {
    expect(totpHealthFailures(healthy)).toEqual([]);
  });

  it("reports every independent production blocker", () => {
    expect(totpHealthFailures({
      ...healthy,
      healthy: false,
      chart: { ...healthy.chart, fresh: false },
      next_episode: null,
      crons: { prepare: false, uk_chart_refresh: false, broadcast_cycle: false },
      invalid_totp_notifications: 2,
    })).toEqual([
      "UK chart snapshot is stale",
      "episode preparation is stopped",
      "chart refresh is stopped",
      "broadcast automation is stopped",
      "no upcoming episode is scheduled",
      "2 notification contract issues",
    ]);
  });
});