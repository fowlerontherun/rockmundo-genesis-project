import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const restrict = readFileSync(
  "supabase/migrations/20261019065313_restrict_untrusted_progression_economy_helpers.sql",
  "utf8",
);
const rewards = readFileSync(
  "supabase/migrations/20261019065642_atomic_event_bound_red_carpet_and_friend_gifts.sql",
  "utf8",
);
const sqlHarness = readFileSync(
  "supabase/tests/privileged_helper_isolation_and_atomic_rewards_harness.sql",
  "utf8",
);
const awards = readFileSync("src/hooks/useAwards.ts", "utf8");
const gifts = readFileSync("src/hooks/useFriendGifts.ts", "utf8");
const giftDialog = readFileSync(
  "src/features/relationships/components/FriendGiftDialog.tsx",
  "utf8",
);

describe("privileged helper RPC isolation (#4226)", () => {
  it("revokes public and authenticated execution for all seven service-only helpers", () => {
    for (const functionName of [
      "increment_user_cash(uuid,numeric)",
      "increment_user_fame(uuid,numeric)",
      "update_player_health(uuid,numeric)",
      "increment_profile_xp(uuid,integer)",
      "increment_value(uuid,numeric)",
      "increment_performance_count(uuid)",
      "increment_relationship_score(uuid,uuid,text,numeric)",
    ]) {
      expect(restrict).toContain(
        `REVOKE ALL ON FUNCTION public.${functionName} FROM PUBLIC, anon, authenticated;`,
      );
      expect(restrict).toContain(
        `GRANT EXECUTE ON FUNCTION public.${functionName} TO service_role;`,
      );
    }
  });

  it("replaces direct red-carpet fame minting with an owner-checked one-time event", () => {
    expect(awards).toContain("attend_award_red_carpet_atomic");
    expect(awards).not.toContain('.rpc("increment_user_fame"');
    expect(rewards).toContain("v_sender"); // Gift caller ownership is also required.
    expect(rewards).toContain("red_carpet_profile_not_owned");
    expect(rewards).toContain("red_carpet_show_not_live");
    expect(rewards).toContain("v_fame := CASE");
    expect(rewards).toContain("fame = fame + v_fame");
    expect(rewards).toContain("REVOKE INSERT ON public.award_red_carpet_events");
  });

  it("makes gift charge and affection one transaction with a durable request key", () => {
    expect(gifts).toContain("send_friend_gift_atomic");
    expect(gifts).not.toContain(".rpc('increment_relationship_score'");
    expect(giftDialog).toContain("requestIdRef.current");
    expect(giftDialog).toContain("requestId");
    expect(rewards).toContain("friend_gifts_request_id_unique_20261019");
    expect(rewards).toContain("friend_gift_sender_not_owned");
    expect(rewards).toContain("friend_gift_insufficient_cash");
    expect(rewards).toContain("cash=cash-(v_cost_cents/100)");
    expect(rewards).toContain("affection_score=LEAST(100");
    expect(rewards).toContain("REVOKE INSERT ON public.friend_gifts");
  });

  it("includes rollback-only live negative cases", () => {
    expect(sqlHarness).toContain("BEGIN;");
    expect(sqlHarness).toContain("ROLLBACK;");
    expect(sqlHarness).toContain("unsafe_privileged_helper");
    expect(sqlHarness).toContain("red_carpet_accepted_unowned_character");
    expect(sqlHarness).toContain("friend_gift_accepted_unowned_character");
  });
});
