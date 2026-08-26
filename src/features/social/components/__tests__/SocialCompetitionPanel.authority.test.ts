import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/features/social/components/SocialCompetitionPanel.tsx"),
  "utf8",
);

const feedSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/pages/community/feed.tsx"),
  "utf8",
);

describe("D11 social competition authority", () => {
  it("routes rivalry mutations through server RPCs", () => {
    expect(source).toContain('db.rpc("request_social_rivalry"');
    expect(source).toContain('db.rpc("respond_social_rivalry"');
    expect(source).toContain('db.rpc("refresh_social_rivalry"');
    expect(source).toContain('db.rpc("leave_social_rivalry"');
    expect(source).not.toMatch(/from\(["']social_rivalries["']\).*\.(insert|update|delete)/s);
  });

  it("uses canonical seasonal and community boundaries", () => {
    expect(source).toContain('db.rpc("join_social_season"');
    expect(source).toContain('db.rpc("get_social_season_leaderboard"');
    expect(source).toContain('db.rpc("create_social_community"');
    expect(source).toContain('db.rpc("join_social_community"');
    expect(source).toContain('db.rpc("leave_social_community"');
  });

  it("makes opt-in and safety behaviour explicit", () => {
    expect(source).toContain("Everything here is optional");
    expect(source).toContain("declined or left without penalty");
    expect(source).toContain("players cannot submit their own scores");
    expect(source).toContain("safety boundaries are intentionally not disclosed");
  });

  it("preserves the existing community feed while adding competition", () => {
    expect(feedSource).toContain("CommunityFeedTimeline");
    expect(feedSource).toContain("SocialCompetitionPanel");
    expect(feedSource).toContain("Community Feed");
    expect(feedSource).toContain("Social Competition");
  });
});
