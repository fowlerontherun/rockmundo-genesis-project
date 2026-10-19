import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261019094500_authoritative_casino_rounds.sql", "utf8");
const harness = readFileSync("supabase/tests/casino_authoritative_rounds_4222.sql", "utf8");
const hook = readFileSync("src/hooks/useCasino.ts", "utf8");
const slots = readFileSync("src/pages/casino/Slots.tsx", "utf8");
const roulette = readFileSync("src/pages/casino/Roulette.tsx", "utf8");
const blackjack = readFileSync("src/pages/casino/Blackjack.tsx", "utf8");
const lobby = readFileSync("src/pages/Casino.tsx", "utf8");

describe("casino P0 server-authoritative payouts (#4222)", () => {
  it("revokes all browser and anonymous calls to the minting legacy RPC", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.play_casino_round(text,numeric,numeric,jsonb)");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(migration).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.casino_transactions");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.play_casino_round_authoritative");
    expect(migration).toContain("TO authenticated,service_role");
  });

  it("creates all outcomes with unbiased pgcrypto draws and caps valid bets", () => {
    expect(migration).toContain("extensions.gen_random_bytes(1)");
    expect(migration).toContain("v_limit:=(256/p_range)*p_range");
    expect(migration).toContain("public.casino_secure_index(44)");
    expect(migration).toContain("public.casino_secure_index(37)");
    expect(migration).toContain("p_bet_amount<10 OR p_bet_amount>10000");
    expect(migration).toContain("CASINO_ROULETTE_STAKE_MISMATCH");
    expect(migration).toContain("CASINO_SLOTS_INVALID_CHOICES");
    expect(migration).toContain("CASINO_ROULETTE_BET_COUNT");
  });

  it("binds the current active character, wallet, addiction and receipt into one transaction", () => {
    expect(migration).toContain("public.current_active_player_profile_id()");
    expect(migration).toContain("AND died_at IS NULL AND deleted_at IS NULL FOR UPDATE");
    expect(migration).toContain("WHERE id=v_profile_id AND user_id=v_user AND cash>=p_bet_amount");
    expect(migration).toContain("INSERT INTO public.casino_transactions");
    expect(migration).toContain("INSERT INTO public.player_addictions");
    expect(migration).toContain("casino_transactions_request_id_unique");
    expect(migration).toContain("CASINO_REQUEST_CONFLICT");
    expect(migration).toContain("'alreadyCompleted',true");
    expect(migration).toContain("FOREIGN KEY (profile_id) REFERENCES public.profiles(id)");
  });

  it("does not send any client-claimed payouts or client outcomes", () => {
    expect(hook).toContain('"play_casino_round_authoritative"');
    expect(hook).toContain("p_request_id: requestId");
    expect(hook).toContain("p_choices: choices");
    expect(hook).not.toContain("p_payout:");
    expect(hook).not.toContain('.rpc("play_casino_round"');
    expect(slots).not.toContain("spinReels()");
    expect(roulette).not.toContain("spinWheel()");
    expect(slots).toContain('recordTransaction("slots", attempt.bet, {}, attempt.requestId)');
    expect(roulette).toContain('recordTransaction("roulette", pending.totalBet, { bets: pending.bets }, pending.requestId)');
  });

  it("keeps pending UUIDs for lost responses and blocks blackjack until server hands exist", () => {
    expect(slots).toContain("pendingRef.current = attempt");
    expect(slots).toContain("Retry this round");
    expect(roulette).toContain("pendingRef.current = pending");
    expect(roulette).toContain("Retry this spin");
    expect(blackjack).toContain("Blackjack temporarily unavailable");
    expect(blackjack).not.toContain("recordTransaction");
    expect(lobby).toContain('disabled={game.key === "blackjack"}');
  });

  it("ships executed rollback verification against spoofing, idempotency, payouts and character isolation", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    for (const check of [
      "replay_same_receipt", "replay_not_paid_twice", "roulette_result_corresponds_to_payout",
      "slots_multiplier_valid", "cash_settled_once", "other_characters_unchanged",
      "all_forged_requests_rejected", "old_browser_denied", "direct_ledger_insert_denied",
    ]) expect(harness).toContain(check);
  });
});
