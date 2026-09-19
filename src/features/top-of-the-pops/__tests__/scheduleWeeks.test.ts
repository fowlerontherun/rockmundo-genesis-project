import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  buildTotpScheduleWeeks,
  formatPlannedRuntime,
  mondayOfIso,
  plannedRuntimeSeconds,
} from "../scheduleWeeks";
import type { TotpScheduleEpisode } from "../scheduleApi";

function episode(date: string, id = date): TotpScheduleEpisode {
  return {
    id,
    episode_number: 1,
    episode_date: date,
    status: "scheduled",
    show_variant: "regular",
    presenter_key: "alex_rayne",
    broadcast_profile: "totp_classic",
    broadcast_at: `${date}T18:30:00.000Z`,
    check_in_at: `${date}T17:00:00.000Z`,
    chart_snapshot_date: date,
    max_performances: 10,
    city_id: null,
    city_name: null,
    performance_count: 0,
    invitation_count: 0,
    checked_in_count: 0,
    has_manifest: false,
    has_plan: false,
  };
}

describe("scheduleWeeks", () => {
  it("snaps any date to the Monday that opens its week", () => {
    expect(mondayOfIso("2026-09-19")).toBe("2026-09-14");
    expect(mondayOfIso("2026-09-20")).toBe("2026-09-14");
    expect(mondayOfIso("2026-09-14")).toBe("2026-09-14");
  });

  it("adds days across month boundaries", () => {
    expect(addDaysIso("2026-09-30", 2)).toBe("2026-10-02");
  });

  it("groups episodes into consecutive Monday-start weeks", () => {
    const weeks = buildTotpScheduleWeeks("2026-09-19", 3, [
      episode("2026-09-18"),
      episode("2026-09-25"),
      episode("2026-10-20"),
    ]);
    expect(weeks).toHaveLength(3);
    expect(weeks[0].weekStart).toBe("2026-09-14");
    expect(weeks[0].episodes.map((e) => e.episode_date)).toEqual(["2026-09-18"]);
    expect(weeks[1].episodes.map((e) => e.episode_date)).toEqual(["2026-09-25"]);
    expect(weeks[2].episodes).toHaveLength(0);
  });

  it("totals planned runtime and ignores invalid durations", () => {
    const total = plannedRuntimeSeconds([
      { id: "a", kind: "performance", title: "Act", durationSeconds: 180 },
      { id: "b", kind: "presenter_link", title: "Link", durationSeconds: Number.NaN },
      { id: "c", kind: "credits", title: "Credits", durationSeconds: 45 },
    ]);
    expect(total).toBe(225);
    expect(formatPlannedRuntime(total)).toBe("3m 45s");
  });
});
