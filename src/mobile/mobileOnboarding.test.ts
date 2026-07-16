import { describe, expect, it } from "vitest";
import { deriveQuickStartSteps, deriveRecommendedAction, getBlockedActionCopy, getPlayerSegment, groupMobileNotifications, type MobileOnboardingState } from "./mobileOnboarding";

const state: MobileOnboardingState = { welcome: "new", completedStepIds: [], dismissedGuidanceIds: [], mobileSessionCount: 1 };
const notif = (overrides: any) => ({ id: Math.random().toString(), user_id: "u", profile_id: "p", category: "social", type: "invite", title: "Band invitation", message: "A band wants a reply", action_path: "/social/requests", metadata: {}, read_at: null, created_at: new Date().toISOString(), ...overrides });

describe("mobile onboarding state derivation", () => {
  it("recognises established first-mobile players without beginner onboarding", () => {
    expect(getPlayerSegment({ profile: { band_id: "band", level: 8 } }, state)).toBe("established-first-mobile");
  });

  it("derives new-player and established quick-start actions from current state", () => {
    expect(deriveQuickStartSteps({ profile: { username: "New" } }, state).map((s) => s.id)).toContain("band");
    expect(deriveQuickStartSteps({ profile: { band_name: "The Tests", level: 5 } }, state).map((s) => s.id)).toEqual(["activity", "messages", "career"]);
  });

  it("uses deterministic recommended action priority and reason text", () => {
    const rec = deriveRecommendedAction({ profile: { energy: 20 } }, []);
    expect(rec?.title).toBe("Restore energy");
    expect(rec?.reason).toContain("energy");
    expect(deriveRecommendedAction({ profile: {} }, [notif({})])?.to).toBe("/mobile/social/requests");
  });

  it("groups and deduplicates notifications with Needs Action first", () => {
    const n = notif({});
    const groups = groupMobileNotifications([n, { ...n, id: "duplicate" }, notif({ id: "world", category: "world", type: "chart", title: "Chart moved" })]);
    expect(groups[0][0]).toBe("Needs Action");
    expect(groups[0][1]).toHaveLength(1);
  });

  it("translates blocked actions into player-friendly requirements", () => {
    const copy = getBlockedActionCopy("energy");
    expect(copy.title).toMatch(/Energy/);
    expect(copy.requirements.join(" ")).not.toMatch(/database|sql|rpc/i);
  });
});
