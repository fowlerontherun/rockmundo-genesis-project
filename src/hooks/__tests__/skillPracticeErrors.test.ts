import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { practiceUtcDayKey, toPracticeBookingMessage } from "../useSkillPractice";

const practiceSource = fs.readFileSync(path.resolve("src/hooks/useSkillPractice.ts"), "utf8");
const profileServiceSource = fs.readFileSync(path.resolve("src/services/profileService.ts"), "utf8");
const runtimeRepair = fs.readFileSync(path.resolve("supabase/migrations/20260822070000_repair_activity_type_constraint_and_practice.sql"), "utf8");

describe("practice booking error messages", () => {
  it.each([
    ["PRACTICE_PAST", "Choose a future practice time."],
    ["PRACTICE_CONFLICT", "That time overlaps another scheduled activity."],
    ["PRACTICE_DAILY_CAP", "The daily limit of 5 practice sessions has been reached for that date."],
    ["PRACTICE_WELLNESS", "Your current wellness prevents training. Visit Wellness to recover."],
    ["PRACTICE_SKILL", "This skill is locked or no longer available."],
    ["PRACTICE_PROFILE", "The active character could not be verified."],
  ])("maps %s safely", (code, expected) => expect(toPracticeBookingMessage(code)).toBe(expected));

  it("identifies the activity-type constraint regression without exposing raw SQL", () => {
    const message = toPracticeBookingMessage('23514 | violates check constraint "player_scheduled_activities_activity_type_check"');
    expect(message).toBe("Practice scheduling needs the latest database update. The selected slot has not been booked.");
    expect(message).not.toContain("23514");
  });

  it("identifies stale or missing practice RPC deployments", () => {
    expect(toPracticeBookingMessage("relation skill_definitions does not exist")).toBe(
      "Practice scheduling is still using an older server function. The selected slot has not been booked.",
    );
    expect(toPracticeBookingMessage("PGRST202 schedule_skill_practice")).toBe(
      "Practice scheduling is not deployed on the server yet. The selected slot has not been booked.",
    );
  });

  it("does not expose an unknown database error", () => {
    expect(toPracticeBookingMessage("relation secret_table does not exist")).not.toContain("secret_table");
  });

  it("uses the UTC date of the selected instant for the practice cap", () => {
    expect(practiceUtcDayKey(new Date("2026-08-20T23:30:00.000Z"))).toBe("2026-08-20");
    expect(practiceUtcDayKey(new Date("2026-08-21T00:30:00.000Z"))).toBe("2026-08-21");
  });

  it("uses the canonical active-character resolver before scheduling practice", () => {
    expect(practiceSource).toContain('import { getActiveProfile } from "@/services/profileService"');
    expect(practiceSource).toContain("profile = await getActiveProfile(user.id)");
    expect(practiceSource).toContain("The active character could not be verified. Refresh and try again.");
    expect(practiceSource).not.toContain(".eq('is_active', true)\n        .is('died_at', null)\n        .single()");

    expect(profileServiceSource).toContain('.order("updated_at", { ascending: false');
    expect(profileServiceSource).toContain('.limit(1)');
    expect(profileServiceSource).toContain('.maybeSingle()');
  });

  it("restores practice and wellness activity types removed by the July constraint rewrite", () => {
    for (const activityType of ["skill_practice", "wellness_recovery", "wellness_medical", "jam_session", "festival_performance", "release_manufacturing"]) {
      expect(runtimeRepair).toContain(`'${activityType}'`);
    }
    expect(runtimeRepair).toContain("CREATE OR REPLACE FUNCTION public.schedule_skill_practice");
    expect(runtimeRepair).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
