import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const repository = source("src/features/festival-company/attendance/festivalDayPlannerRepository.ts");
const plannerRepair = source("supabase/migrations/20260907082132_repair_festival_attendee_c5_planner_metadata.sql");
const stageRepair = source("supabase/migrations/20260907082308_repair_festival_attendee_stage_schedule_bridge.sql");
const handoff = source("supabase/migrations/20291219110050_festival_c5_compatibility_fk_handoff.sql");

describe("Festival attendee stage runtime production repair", () => {
  it("provides every stage-planner RPC used by Festival Mode", () => {
    for (const rpc of [
      "get_my_festival_stage_schedule",
      "preview_festival_stage_plan_item",
      "add_festival_stage_performance_to_day_plan",
    ]) {
      expect(repository).toContain(rpc);
      expect(stageRepair).toContain(`FUNCTION public.${rpc}`);
    }
  });

  it("uses the live simplified booking and site-plan authority", () => {
    expect(stageRepair).toContain("public.festival_artist_bookings");
    expect(stageRepair).toContain("public.festival_artist_programmes");
    expect(stageRepair).toContain("public.festival_site_plan_stages");
    expect(stageRepair).toContain("_festival_simplified_timetable_projection");
    expect(stageRepair).toContain("festival_public_projection_v2");
    expect(stageRepair).not.toContain("festival_schedule_revisions");
  });

  it("adds C5 planner metadata without inventing client-side reward state", () => {
    expect(plannerRepair).toContain("ADD COLUMN IF NOT EXISTS source");
    expect(plannerRepair).toContain("ADD COLUMN IF NOT EXISTS schedule_item_id");
    expect(plannerRepair).toContain("ADD COLUMN IF NOT EXISTS stage_id");
    expect(plannerRepair).toContain("festival_plan_watch_act_requires_stage_schedule");
    expect(plannerRepair).not.toContain("awardXp");
  });

  it("hands temporary compatibility foreign keys to the later canonical schedule domain", () => {
    expect(handoff).toContain("DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_schedule_booking_fkey");
    expect(handoff).toContain("REFERENCES public.festival_schedule_items(id)");
    expect(handoff).toContain("REFERENCES public.festival_stages(id)");
  });
});
