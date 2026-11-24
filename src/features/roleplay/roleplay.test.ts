import { describe, expect, it } from "vitest";
import { friendlyRoleplayError, parseChatInput, SOCIAL_XP_DAILY_CAP, SOCIAL_XP_PER_INTERACTION } from "./roleplay";

describe("roleplay chat input", () => {
  it("treats /me as an action", () => expect(parseChatInput("/me slams his pint down")).toEqual({ kind: "me", body: "slams his pint down" }));
  it("treats /ooc and double brackets as out of character", () => {
    expect(parseChatInput("/ooc brb")).toEqual({ kind: "ooc", body: "brb" });
    expect(parseChatInput("((brb))")).toEqual({ kind: "ooc", body: "brb" });
  });
  it("uses the chosen mode for plain text and ignores blanks", () => {
    expect(parseChatInput("hello", "me")).toEqual({ kind: "me", body: "hello" });
    expect(parseChatInput("   ")).toBeNull();
  });
  it("caps messages at 500 characters", () => expect(parseChatInput("a".repeat(600))?.body.length).toBe(500));
  it("rewards 10 XP up to 100 a day", () => { expect(SOCIAL_XP_PER_INTERACTION).toBe(10); expect(SOCIAL_XP_DAILY_CAP).toBe(100); });
  it("explains cooldowns", () => expect(friendlyRoleplayError("ERROR: cooldown_active")).toMatch(/hour/));
});
