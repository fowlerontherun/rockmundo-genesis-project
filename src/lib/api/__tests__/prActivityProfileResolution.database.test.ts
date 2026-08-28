import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const edgeFunction = readFileSync("supabase/functions/process-pr-activity/index.ts", "utf8");
const offersClient = readFileSync("src/components/pr/PROffersList.tsx", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("PR activity character resolution", () => {
  it("schedules the band's leader profile for accounts with multiple characters", () => {
    expect(edgeFunction).toContain(".from('bands')");
    expect(edgeFunction).toContain(".select('leader_id')");
    expect(edgeFunction).toContain(".eq('id', offer.band_id)");
    expect(edgeFunction).toContain(".eq('id', band.leader_id)");
    expect(edgeFunction).toContain("profile_id: leaderProfile.id");
    expect(edgeFunction).toContain("user_id: scheduledUserId");
    expect(edgeFunction).not.toContain(".eq('user_id', offer.user_id)\n        .single()");
  });

  it("authorizes the current leader and reserves completion for the scheduled worker", () => {
    expect(edgeFunction).toContain("supabaseClient.auth.getUser(token)");
    expect(edgeFunction).toContain("callerUserId !== leaderProfile.user_id");
    expect(edgeFunction).toContain("Only the scheduled PR worker can complete an appearance");
    expect(config).toContain("[functions.process-pr-activity]\nverify_jwt = true");
  });

  it("shows the server's actionable failure instead of Supabase's generic non-2xx message", () => {
    expect(offersClient).toContain("getEdgeFunctionErrorMessage");
    expect(offersClient).toContain("This PR offer could not be processed.");
  });
});
