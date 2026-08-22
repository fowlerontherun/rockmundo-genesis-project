import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { practiceUtcDayKey, toPracticeBookingMessage } from "../useSkillPractice";

const practiceSource = fs.readFileSync(path.resolve("src/hooks/useSkillPractice.ts"), "utf8");
const profileServiceSource = fs.readFileSync(path.resolve("src/services/profileService.ts"), "utf8");

describe("practice booking error messages", () => {
  it.each([
    ["PRACTICE_PAST", "Choose a future practice time."],
    ["PRACTICE_CONFLICT", "That time overlaps another scheduled activity."],
    ["PRACTICE_DAILY_CAP", "The daily limit of 5 practice sessions has been reached for that date."],
    ["PRACTICE_WELLNESS", "Your current wellness prevents training. Visit Wellness to recover."],
    ["PRACTICE_SKILL", "This skill is locked or no longer available."],
    ["PRACTICE_PROFILE", "The active character could not be verified."],
  ])("maps %s safely", (code, expected) => expect(toPracticeBookingMessage(code)).toBe(expected));

  it("does not expose an unknown database error", () => {
    expect(toPracticeBookingMessage("relation secret_table does not exist")).not.toContain("secret_table");
  });

  it("uses the UTC date of the selected instant for the practice cap", () => {
    expect(practiceUtcDayKey(new Date("2026-08-20T23:30:00.000Z"))).toBe("2026-08-20");
    expect(practiceUtcDayKey(new Date("2026-08-21T00:30:00.000Z"))).toBe("2026-08-21");
  });

  it("uses the canonical active-character resolver before scheduling practice", () => {
    expect(practiceSource).toContain('import { getActiveProfile } from "@/services/profileService"');
    expect(practiceSource).toContain("const profile = await getActiveProfile(user.id)");
    expect(practiceSource).not.toContain(".eq('is_active', true)\n        .is('died_at', null)\n        .single()");

    // The canonical resolver is deliberately tolerant of legacy accounts with
    // duplicate active rows and deterministically picks the newest active one.
    expect(profileServiceSource).toContain('.order("updated_at", { ascending: false');
    expect(profileServiceSource).toContain('.limit(1)');
    expect(profileServiceSource).toContain('.maybeSingle()');
  });
});
