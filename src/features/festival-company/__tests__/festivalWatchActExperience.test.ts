import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const myDay = source("src/features/festival-company/attendance/FestivalModeMyDay.tsx");
const conditions = source("src/features/festival-company/attendance/festivalConditions.ts");
const runtime = source("supabase/migrations/20260907083055_complete_festival_watch_act_runtime.sql");

describe("Festival attendee watch-act experience", () => {
  it("exposes planned stage performances as an executable My Day action", () => {
    expect(myDay).toContain('"watch_act"');
    expect(myDay).toContain('item.source === "stage_schedule"');
    expect(myDay).toContain('"Watch now"');
    expect(myDay).toContain('"Set not started"');
    expect(myDay).toContain('"Set finished"');
  });

  it("keeps watch completion on the authoritative activity resolver", () => {
    expect(myDay).toContain("resolver.mutate({ planItemId: item.id })");
    expect(conditions).toContain('"watch_act"');
    expect(runtime).toContain("CREATE OR REPLACE FUNCTION public.resolve_festival_plan_activity");
    expect(runtime).toContain("v_item.activity_type = 'watch_act'");
    expect(runtime).toContain("v_item.source <> 'stage_schedule'");
  });

  it("reports watched-set progress without awarding progression in the client", () => {
    expect(myDay).toContain("Set watched. Your Festival inspiration and rewards progress were updated.");
    expect(myDay).not.toContain("awardXp");
    expect(myDay).not.toContain("attribute_points");
    expect(runtime).not.toContain("UPDATE public.player_xp_wallet");
  });
});
