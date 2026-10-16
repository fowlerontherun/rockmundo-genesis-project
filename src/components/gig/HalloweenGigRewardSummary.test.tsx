// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HalloweenGigRewardSummary } from "./HalloweenGigRewardSummary";

afterEach(cleanup);
const reward = {
  halloween_2026: { event_id: "haunted-stage-2026", applied: true, performance_pct: 10, qualifying_members: 2 },
  halloween_2026_first_rewards: { awarded_profiles: ["me"], xp_each: 500 },
};

describe("Halloween completed gig result", () => {
  it("shows the actual saved rating modifier, not a new random result", () => {
    render(<HalloweenGigRewardSummary xpBreakdown={reward} profileId="other" />);
    expect(screen.getByRole("region", { name: "Halloween gig rewards" })).toBeTruthy();
    expect(screen.getByText(/boosted the completed performance by/)).toHaveProperty("textContent", expect.stringContaining("+10%"));
    expect(screen.getByText(/2 qualifying performer/)).toBeTruthy();
    expect(screen.queryByText(/500 bonus XP/)).toBeNull();
  });

  it("shows first-time XP and achievement only for the awarded character", () => {
    render(<HalloweenGigRewardSummary xpBreakdown={reward} profileId="me" />);
    expect(screen.getByText(/500 bonus XP and unlocked Pumpkin Headliner 2026/)).toBeTruthy();
  });

  it.each([
    null,
    {},
    { halloween_2026: { ...reward.halloween_2026, applied: false } },
    { halloween_2026: { ...reward.halloween_2026, performance_pct: 0 } },
    { halloween_2026: { ...reward.halloween_2026, performance_pct: 30 } },
    { halloween_2026: { ...reward.halloween_2026, event_id: "other-event" } },
  ])("does not invent a Halloween result when there is no authoritative evidence", (xpBreakdown) => {
    render(<HalloweenGigRewardSummary xpBreakdown={xpBreakdown} profileId="me" />);
    expect(screen.queryByRole("region", { name: "Halloween gig rewards" })).toBeNull();
  });
});
