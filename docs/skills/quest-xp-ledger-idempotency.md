# Quest XP payout: ledger idempotency requirement

Verified live on 2026-10-09:

- `experience_ledger` has a primary key on `id` only; no unique constraint on `metadata.claim_id`.
- `experience_ledger.user_id` and `activity_type` are required; `profile_id` is nullable.
- `player_xp_wallet` exposes `xp_balance` and `lifetime_xp` (general XP) separately from `skill_xp_balance` and `skill_xp_lifetime`.
- Wallet updates invoke profile overall level recalculation.
- GitHub's pending `skill_quest_reward_claims.xp_ledger_id` references `xp_ledger`, which does not exist in production. Do not point it at `experience_ledger` without a migration and tests.

## Required implementation

Introduce a claim-specific uniqueness guarantee on the **authoritative payout ledger** (e.g. partial unique index for `activity_type='skill_quest_reward'` on `metadata->>'claim_id'`, after checking for duplicates and ensuring `claim_id` is always populated). Keep the claim-row `FOR UPDATE` lock as a second defence.

Atomic transaction must:
1. Verify a trusted source event, matching enabled reward definition and service-only authorization.
2. Lock claim and player wallet/profile consistently.
3. Insert one idempotent XP ledger entry and increment `xp_balance`/`lifetime_xp` exactly once.
4. Mark claim granted with its ledger evidence in the same transaction.
5. Preserve the wallet trigger's level recalculation; avoid double-updating experience through other grant helpers.

Do not create a unique index on all ledger rows with nullable claim IDs; scope it to quest payouts and validate existing records first.

Test rollback, stale claims, replay and concurrent workers in staging before activating any definitions. This is a review contract, not a deployed migration.
