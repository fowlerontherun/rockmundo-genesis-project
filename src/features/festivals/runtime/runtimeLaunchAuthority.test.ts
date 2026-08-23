import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Festival simplified launch authority", () => {
  it("requires a genuine player act while keeping total acts for licence ceilings", () => {
    const canonical = read(
      "supabase/migrations/20291218252600_festival_player_act_launch_authority.sql",
    );
    const reconciliation = read(
      "supabase/reconciliation/festival/20260823_festival_player_act_launch_authority.sql",
    );

    for (const sql of [canonical, reconciliation]) {
      expect(sql).toContain("confirmed_player_acts");
      expect(sql).toContain("'confirmedPlayerActs'");
      expect(sql).toContain("festival_player_act_required");
      expect(sql).toContain("artist_type IN ('solo', 'band')");
      expect(sql).toContain(
        "status IN ('confirmed', 'awaiting_schedule', 'scheduled')",
      );
      expect(sql).toContain("confirmed_acts > max_acts_per_day * duration_days");
    }
  });

  it("exposes the player-act count in the active Run Festival UI", () => {
    const service = read("src/features/festivals/runtime/service.ts");
    const controlRoom = read(
      "src/features/festivals/runtime/FestivalLiveControlRoom.tsx",
    );

    expect(service).toContain("confirmedPlayerActs: z.number().int().nonnegative()");
    expect(controlRoom).toContain('label="Confirmed player acts"');
    expect(controlRoom).toContain("readiness.confirmedPlayerActs");
  });

  it("removes player access to the retired schedule-backed runtime path", () => {
    const canonical = read(
      "supabase/migrations/20291218252700_restrict_legacy_festival_runtime_rpcs.sql",
    );
    const reconciliation = read(
      "supabase/reconciliation/festival/20260823_restrict_legacy_festival_runtime_rpcs.sql",
    );
    const service = read("src/features/festivals/runtime/service.ts");

    for (const sql of [canonical, reconciliation]) {
      expect(sql).toContain("prepare_festival_edition_runtime");
      expect(sql).toContain("transition_festival_edition_runtime");
      expect(sql).toContain("FROM PUBLIC, anon, authenticated");
      expect(sql).toContain("TO service_role");
    }

    expect(service).not.toContain("prepareEditionRuntime");
    expect(service).not.toContain("transitionEditionRuntime");
  });
});
