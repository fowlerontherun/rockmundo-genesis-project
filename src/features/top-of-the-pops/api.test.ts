import { describe, expect, it } from "vitest";
import { canAttemptTotpCheckIn, canRespondToTotpInvitation, type TotpInvitation } from "./api";

const baseInvitation: TotpInvitation = {
  invitation_id: "11111111-1111-4111-8111-111111111111",
  episode_id: "22222222-2222-4222-8222-222222222222",
  episode_date: "2026-10-01",
  check_in_at: "2026-10-01T14:00:00.000Z",
  broadcast_at: "2026-10-01T19:00:00.000Z",
  band_id: "33333333-3333-4333-8333-333333333333",
  band_name: "Shockmaster",
  song_id: "44444444-4444-4444-8444-444444444444",
  song_title: "Dead Radio",
  qualifying_rank: 7,
  status: "invited",
  response_deadline: "2026-09-30T17:00:00.000Z",
  london_city_id: "55555555-5555-4555-8555-555555555555",
  london_city_name: "London",
};

describe("Top of the Pops invitation timing", () => {
  it("only allows invitation responses before the deadline", () => {
    expect(canRespondToTotpInvitation(baseInvitation, new Date("2026-09-30T16:59:59.000Z"))).toBe(true);
    expect(canRespondToTotpInvitation(baseInvitation, new Date("2026-09-30T17:00:01.000Z"))).toBe(false);
    expect(canRespondToTotpInvitation({ ...baseInvitation, status: "accepted" }, new Date("2026-09-30T16:00:00.000Z"))).toBe(false);
  });

  it("opens check-in two hours before studio call and closes 45 minutes after", () => {
    const accepted = { ...baseInvitation, status: "accepted" as const };
    expect(canAttemptTotpCheckIn(accepted, new Date("2026-10-01T11:59:59.000Z"))).toBe(false);
    expect(canAttemptTotpCheckIn(accepted, new Date("2026-10-01T12:00:00.000Z"))).toBe(true);
    expect(canAttemptTotpCheckIn(accepted, new Date("2026-10-01T14:45:00.000Z"))).toBe(true);
    expect(canAttemptTotpCheckIn(accepted, new Date("2026-10-01T14:45:01.000Z"))).toBe(false);
  });
});
