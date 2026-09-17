import { describe, expect, it } from "vitest";
import { getTotpBroadcastPhase } from "./TotpBroadcastStatusCard";
import type { TotpEpisode } from "./api";

const baseEpisode: TotpEpisode = {
  id: "episode-1",
  episode_number: 2,
  episode_date: "2026-10-01",
  status: "inviting",
  check_in_at: "2026-10-01T14:00:00.000Z",
  broadcast_at: "2026-10-01T19:00:00.000Z",
  presenter_key: "alex_rayne",
  broadcast_profile: "totp_studio",
  performances: [],
};

describe("getTotpBroadcastPhase", () => {
  it("keeps a future episode in the invitation phase", () => {
    expect(getTotpBroadcastPhase(baseEpisode, new Date("2026-09-30T10:00:00.000Z"))).toBe("inviting");
  });

  it("opens the studio phase two hours before call time", () => {
    expect(getTotpBroadcastPhase(baseEpisode, new Date("2026-10-01T12:30:00.000Z"))).toBe("studio");
  });

  it("switches to broadcast countdown from studio call until air time", () => {
    expect(getTotpBroadcastPhase(baseEpisode, new Date("2026-10-01T15:00:00.000Z"))).toBe("countdown");
  });

  it("treats server broadcast status as live", () => {
    expect(getTotpBroadcastPhase({ ...baseEpisode, status: "broadcast" }, new Date("2026-10-01T18:00:00.000Z"))).toBe("live");
  });

  it("treats completed episodes as completed", () => {
    expect(getTotpBroadcastPhase({ ...baseEpisode, status: "completed" }, new Date("2026-10-02T10:00:00.000Z"))).toBe("completed");
  });
});
