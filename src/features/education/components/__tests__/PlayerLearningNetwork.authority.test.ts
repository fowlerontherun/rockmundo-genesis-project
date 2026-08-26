import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../../");
const source = fs.readFileSync(
  path.join(repoRoot, "src/features/education/components/PlayerLearningNetwork.tsx"),
  "utf8",
);

describe("D10 player-led education authority", () => {
  it("keeps mentorship and class mutations behind RPC boundaries", () => {
    expect(source).toContain('rpc("set_community_mentorship_profile"');
    expect(source).toContain('rpc("request_community_mentorship"');
    expect(source).toContain('rpc("respond_community_mentorship"');
    expect(source).toContain('rpc("leave_community_mentorship"');
    expect(source).toContain('rpc("process_community_mentorship_progress"');
    expect(source).toContain('rpc("create_player_education_class"');
    expect(source).toContain('rpc("enrol_player_education_class"');
    expect(source).toContain('rpc("check_in_player_education_class"');
    expect(source).toContain('rpc("complete_player_education_class"');

    expect(source).not.toMatch(
      /\.from\(["'](?:community_mentorship_profiles|community_mentorship_matches|community_mentorship_goals|community_mentorship_rewards|player_education_classes|player_education_class_enrolments|player_education_reward_ledger)["']\)\.(?:insert|update|delete|upsert)/,
    );
  });

  it("makes the safety and verified-progression rules visible to players", () => {
    expect(source).toContain("penalty-free to leave");
    expect(source).toContain("verified skill levels improve");
    expect(source).toContain("Blocks apply to discovery, requests and classes");
    expect(source).toContain("Prices are capped at $500");
    expect(source).toContain("server-timed check-in and completion");
  });
});
