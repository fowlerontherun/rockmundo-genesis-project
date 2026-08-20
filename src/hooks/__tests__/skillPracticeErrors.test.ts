import { describe, expect, it } from "vitest";
import { toPracticeBookingMessage } from "../useSkillPractice";

describe("practice booking error messages", () => {
  it.each([
    ["PRACTICE_PAST", "Choose a future practice time."],
    ["PRACTICE_CONFLICT", "That time overlaps another scheduled activity."],
    ["PRACTICE_DAILY_CAP", "The daily limit of 5 practice sessions has been reached for that date."],
    ["PRACTICE_WELLNESS", "Your current wellness prevents training. Visit Wellness to recover."],
    ["PRACTICE_SKILL", "This skill is locked or no longer available."],
  ])("maps %s safely", (code, expected) => expect(toPracticeBookingMessage(code)).toBe(expected));

  it("does not expose an unknown database error", () => {
    expect(toPracticeBookingMessage("relation secret_table does not exist")).not.toContain("secret_table");
  });
});
