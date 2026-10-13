import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const sql = read("../../../../supabase/migrations/20261013195500_verified_relationship_affinity.sql");
const api = read("../api.ts");
const hook = read("../hooks/useRelationshipEvents.ts");
const action = read("../../../../supabase/functions/relationship-action/index.ts");

describe("relationship affinity and character isolation contracts", () => {
  it("#3942 disallows player-authored ledger credits and ignores feed numeric metadata", () => {
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.relationship_xp_log");
    expect(sql).toContain('DROP POLICY IF EXISTS "Players can insert their own relationship XP log"');
    expect(sql).toContain("GRANT INSERT,UPDATE,DELETE,SELECT ON public.relationship_xp_log TO service_role");
    expect(api).toContain("const affinityScore = Number.isSafeInteger(verifiedAffinityScore)");
    expect(api).not.toContain("event.metadata?.affinity_value");
  });

  it("#3943 fetches and displays only the requested pair", () => {
    expect(api).toContain('.contains("metadata", { [RELATIONSHIP_PAIR_KEY]: pairKey })');
    expect(api).toContain("return targetPairKey === pairKey");
    expect(api).not.toContain("targetProfileId === otherProfileId ||");
  });

  it("#3944 uses SQL aggregation over every authoritative ledger row, separate from timeline limit", () => {
    expect(sql).toContain("sum(greatest(0,coalesce(l.xp_awarded,0))::bigint)");
    expect(sql).toContain("WHERE l.pair_key=v_pair_key");
    expect(sql).toContain("p.user_id=auth.uid()");
    expect(api).toContain('.rpc("get_verified_relationship_affinity"');
    expect(hook).toContain("fetchVerifiedRelationshipAffinityScore(profileId, otherProfileId)");
    expect(hook).toContain("calculateRelationshipSummary(events, affinityScore)");
  });

  it("#3950 strips fake pair and affinity metadata from both writers and enforces at database layer", () => {
    expect(api).toContain("delete safeMetadata.affinity_value");
    expect(api).toContain("delete safeMetadata.relationship_pair_key");
    expect(api).toContain("relationship_actor_profile_id: profileId");
    expect(action).toContain("delete safeRelationshipMetadata.affinity_value");
    expect(action).toContain("relationship_actor_profile_id: profile_id");
    expect(action).toContain("profile_id,");
    expect(sql).toContain("CREATE TRIGGER enforce_relationship_feed_pair");
    expect(sql).toContain("RELATIONSHIP_ACTOR_USER_MISMATCH");
    expect(sql).toContain("RELATIONSHIP_TARGET_INVALID");
  });

  it("#3951 filters account-wide activity down to selected character", () => {
    expect(api).toContain('.eq("profile_id", profileId)');
    expect(api).not.toContain('.eq("user_id", profile.user_id)');
  });
});
