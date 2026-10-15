# RockMundo — October 8–15 migration reconciliation, pass 5

**Reviewed:** 15 October 2026. **Production:** Supabase `yztogmdixmchsmimtent`. **Tracker:** [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).

This pass follows the 180-path Git ↔ live exact-SQL hash audit and passes 2–4. It reassesses the last 7 days' outstanding SQL against the current **1,468-entry** live history. Avoid `supabase db push` for the historical directory: superseded files can overwrite working replacements, and some contain inactive payouts or incompatible table references.

## What changed in this pass

- `supabase/migrations/` is unchanged from the last pass: main subtree `fe173da71e86cb6e9238594f70158149f2962160` (1,926 SQL files); no new migration-file additions in this pass.
- The six previous **applied but missing** SQL statements recovered from production into [PR #4150](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4150) are now **merged**. Their exact Git object hashes match production. These are source-history records, not scripts to replay.
- The already-existing `increment_song_release_stream_totals(uuid,bigint,numeric)` RPC was checked: it matches the original `20261012223000_atomic_stream_totals.sql` function body and uses service-only authorization; **do not replay** solely because original migration identity is missing. It accepts null inputs without an explicit early guard, which warrants a separate nonurgent hardening review, not an unrelated financial rewrite.
- The three older October 9 `process_skill_quest_xp_claim` migrations all reference absent `xp_ledger` and `profile_action_xp_events` and must **never be applied intact**.

## Direct production reconciliation performed now

Applied source-controlled migration **`20261015171019 rockmundo_20261015_quest_reward_live_wallet_service_only`** from [PR #4151](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4151), `supabase/production-repairs/20261015_quest_reward_live_wallet_service_only.sql`, blob `4565d8c7e56e5ef0b4129648227b5fccd31091fd` (PR already merged).

This creates the previously missing **`process_skill_quest_xp_claim(uuid)`** function against the canonical `experience_ledger` and `player_xp_wallet`. It checks the service-role JWT, claim/definition/source-event consistency, active character, amount, ledger evidence, and prevents payout replay with the existing `experience_ledger_quest_claim_unique` index and row locks. The deployment explicitly refuses to install while any reward definition is enabled. The function **was not called** and no payout schedule was added.

**Postchecks verified:**
- 1,468 live migration history entries; function exists with `anon EXECUTE = false`, `authenticated EXECUTE = false`, `service_role EXECUTE = true`.
- Exactly **23 pending claims**, total **9,200 XP**, still all pending; `xp_ledger_id` remains NULL for each.
- Exactly **4 reward definitions**, all **disabled**; zero `skill_quest_reward` ledger entries.
- This is a schema/permissions postcheck, **not** an end-to-end transaction/concurrency test. Keep definitions disabled and do not process or backfill the 23 claims until separately reviewed rollout on disposable staging characters with 0/1/2 payout and rollback tests.

## Seven-day source-file decisions refreshed

| Original SQL workstream | Live evidence | Current decision |
|---|---|---|
| Oct 9 skill-quest XP processor and two hardeners | Service-only, canonical-ledger compatible replacement installed above | **Superseded; no replay** |
| Oct 12 atomic stream totals | Exact equivalent service-only RPC is present | **Effect applied; no replay** |
| Oct 12 crafting `20261012215100` | 4 RPCs, raw inventory lock, tiered skill eligibility installed via Oct 15 repairs | **Superseded; do not reference absent gear_categories** |
| Oct 12 video `20261012235600` | Compatible catalog-backed cooldown/RPC installed; claim table RLS on | **Superseded; watch-completion attestation still needed** |
| Oct 12 legacy skill book `20261012235900` | Direct inventory updates locked; `complete_legacy_skill_book_atomic` absent; **0 legacy books** exist | **Do not run original** (absent `progression_award_action_xp`). Build canonical purchase provenance/XP completion once feature is ready |
| Oct 13 AP conversion | Compatible wallet/ledger RPC installed | **Superseded** |
| Oct 13 band leadership/leave; 2030-dated governance | Live profile-identity corrections, atomic actions and guard triggers active | **Superseded** |
| Oct 13 friend mutual counts, social discovery and public profile visibility; 2030 opt-in discovery | Private-first profile foundation, safe suggestions, mutual counts, discovery gate active; player_profiles row count is zero | **Superseded** and no historical publication |
| Oct 14 durable notifications | Inbox ownership, event deduplication, game/music/offer/invite triggers via targeted repairs | **Partially superseded**; generic event backfill/triggers remain separate review |
| Oct 15 recording refund/claim/unique-takes | Exact SQL applied; recording Edge Worker v413 references claimed/finalize/release, XP and source-session | **Applied; no SQL replay**. End-to-end worker smoke test pending |
| Oct 13 achievements integrity | `achievement_criteria`, `achievement_events`, `achievement_rewards` absent | **Blocked**; require canonical foundations before RPCs |
| Oct 12 underworld purchase/consume; Oct 13 arrest | Atomic buy/consume and arrest functions absent | **Unapplied**; validate stock, item value, prison consequence and safe idempotent transaction |
| Oct 13 retirement/recovery | Atomic character lifecycle RPCs absent | **Unapplied**; stage identity/inheritance changes |
| Oct 12 business hiring/subsidiary purchases | User-supplied purchase amount risk in original SQL | **Blocked**; server-priced replacements |
| Oct 12 sponsorship and 2030-dated payroll; incremental band earnings trigger | 44,882 `band_earnings`; 31 primary treasuries match 31 displayed balances **currently**; dangerous `update_band_balance_from_earnings` `SUM(amount)` trigger persists, authenticated direct INSERT still possible; sponsorship_payments=0 | **Finance-blocked**, verified PITR restore + ledger/caller cutover needed; never replay payout cron or retroactive income |

## Immediate priorities

1. **Do not enable skill-quest reward definitions.** Test service-only processor with staging/mock profiles and concurrency and prove duplicate and failure paths before reward activation. Zero live payouts is the correct current state.
2. Reconcile **underworld** purchase/consume and arrest RPCs using fixed authoritative prices and per-character locks; stage test. Investigate whether the clients already call absent endpoints.
3. Reconcile **legacy book** provenance and XP function, retaining the current locked inventory API and avoiding phantom XP.
4. Build canonical achievements schema and controlled career/backfill gates; avoid historical mass payouts.
5. Refactor finance earning writers and rehearse PITR before changing SUM-trigger/payroll/sponsorship. Do not alter any player cash or treasury in this audit pass.

All observations refer to specific database schema or history objects, not validated in-game behavior. No finance records, player cash, personal XP balances, cron schedules, disabled reward definitions or quest claims were changed by the pass 5 deployment.
