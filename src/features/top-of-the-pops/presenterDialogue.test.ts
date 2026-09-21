import { describe, expect, it } from "vitest";
import type { TotpEpisode } from "./api";
import { buildTotpPresenterDialogue, TOTP_CHART_PRESENTER_LINE } from "./presenterDialogue";

const episode: TotpEpisode = {
  id: "episode-1",
  episode_number: 1,
  episode_date: "2026-09-24",
  status: "locked",
  check_in_at: "2026-09-24T17:00:00Z",
  broadcast_at: "2026-09-24T18:30:00Z",
  presenter_key: "alex_rayne",
  broadcast_profile: "standard",
  performances: [
    {
      performance_id: "p1",
      running_order: 1,
      band_id: "b1",
      band_name: "Shockmaster",
      song_id: "s1",
      song_title: "Dead Radio",
      stage_key: "main_stage",
      presenter_intro: "First tonight, Shockmaster!",
      qualifying_rank: 4,
    },
    {
      performance_id: "p2",
      running_order: 2,
      band_id: "b2",
      band_name: "Neon Vows",
      song_id: "s2",
      song_title: "Glass Parade",
      stage_key: "stage_b",
      presenter_intro: "Now, Neon Vows!",
      qualifying_rank: 1,
    },
  ],
};

describe("Top of the Pops presenter dialogue", () => {
  it("builds every recordable line in broadcast order", () => {
    const lines = buildTotpPresenterDialogue(episode);
    expect(lines.map((line) => line.kind)).toEqual([
      "opening",
      "act_intro",
      "between",
      "chart",
      "act_intro",
      "closing",
    ]);
    expect(lines.find((line) => line.kind === "chart")?.script).toBe(TOTP_CHART_PRESENTER_LINE);
    expect(lines.find((line) => line.id === "act:p1")?.planKey).toBe("p1");
  });

  it("keeps spoken continuity band-led while song titles stay visual-only", () => {
    const lines = buildTotpPresenterDialogue(episode);
    const opening = lines.find((line) => line.kind === "opening")?.script ?? "";
    const between = lines.find((line) => line.kind === "between")?.script ?? "";
    const closing = lines.find((line) => line.kind === "closing")?.script ?? "";

    expect(opening).toContain("Shockmaster");
    expect(between).toContain("Neon Vows");
    expect(between).not.toContain("Glass Parade");
    expect(between).toContain("stage b");
    expect(between).toContain("another chart hit from Neon Vows");
    expect(closing).toContain("Neon Vows");
    expect(closing).not.toContain("Glass Parade");
  });
});
