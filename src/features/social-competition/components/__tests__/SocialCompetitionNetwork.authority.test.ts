import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const component = fs.readFileSync(
  path.resolve("src/features/social-competition/components/SocialCompetitionNetwork.tsx"),
  "utf8",
);
const socialHub = fs.readFileSync(path.resolve("src/pages/SocialHub.tsx"), "utf8");
const appRoutes = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
const hubNavigation = fs.readFileSync(path.resolve("src/config/hubNavigation.ts"), "utf8");
const mobileSocial = fs.readFileSync(path.resolve("src/mobile/pages/MobileSocial.tsx"), "utf8");
const mobileRoutes = fs.readFileSync(path.resolve("src/mobile/routeRegistry.ts"), "utf8");

describe("D11 social competition authority contract", () => {
  it("keeps every competitive mutation behind an authenticated RPC", () => {
    for (const rpc of [
      "request_social_rivalry",
      "respond_social_rivalry",
      "leave_social_rivalry",
      "refresh_social_rivalry",
      "request_social_band_rivalry",
      "respond_social_band_rivalry",
      "leave_social_band_rivalry",
      "refresh_social_band_rivalry",
      "create_social_community",
      "join_social_community",
      "leave_social_community",
      "update_social_community",
      "remove_social_community_member",
      "join_social_season",
      "leave_social_season",
    ]) {
      expect(component).toContain(`supabase.rpc("${rpc}"`);
    }

    for (const table of [
      "social_rivalries",
      "social_rivalry_events",
      "social_communities",
      "social_community_memberships",
      "social_competition_entries",
      "leaderboard_badge_awards",
    ]) {
      expect(component).not.toContain(`.from("${table}")`);
    }
    expect(component).not.toContain("as any");
  });

  it("makes consent, exits, safety and bounded rewards visible", () => {
    expect(component).toContain("Consent first.");
    expect(component).toContain("leave without a gameplay penalty");
    expect(component).toContain("SafetyActions");
    expect(component).toContain("Fixed-baseline, one-account entry");
    expect(component).toContain("never money, XP, AP or stat power");
    expect(component).toContain("Blocked owners and private non-member groups are excluded by the server");
  });

  it("wires one competition surface into desktop, legacy and mobile navigation", () => {
    expect(appRoutes).toContain('path="social/competition"');
    expect(socialHub).toContain('child === "competition"');
    expect(socialHub).toContain('competition: "/social/competition"');
    expect(socialHub).toContain('communities: "/social/competition"');
    expect(socialHub).toContain('rivals: "/social/competition"');
    expect(hubNavigation).toContain('id: "competition"');
    expect(mobileSocial).toContain('section === "competition"');
    expect(mobileSocial).toContain("<SocialCompetitionNetwork showIntro={false}/>");
    expect(mobileRoutes).toContain('clean === "/social/competition"');
  });
});
