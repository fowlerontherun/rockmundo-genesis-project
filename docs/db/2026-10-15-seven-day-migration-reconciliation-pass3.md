# RockMundo migration reconciliation — pass 3 (2026-10-15)

Tracker: [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).
Follows merged [original exact-hash inventory](./2026-10-15-seven-day-live-migration-audit.md) and
[second live-effects inventory](./2026-10-15-seven-day-live-effect-verification-pass2.md).

**Live production**: Supabase `yztogmdixmchsmimtent`. Read-only preflights this pass; no new schema/data migrations applied by this report. Observed **1,449** recorded migrations, including one installation since pass 2. Do not replay originals based on absent filename identity. Do not run `supabase db push` against the October directory.

## Changes since the prior tree audit

The `supabase/migrations` Git tree changed from `a482a951a5924640ab7368244a4f30e6bc32f5be` (1,925 files) to `fe173da71e86cb6e9238594f70158149f2962160` (1,926 files). **Exactly one file was added, zero changed, zero removed**:
`20261015124500_recording_refund_claims_and_unique_takes.sql`, blob `363a9c494bdbb33be2455896c0095ee6de2d610d`.

Live migration recorded:
`20261015151606 rockmundo_20261015124500_recording_refund_claims_and_unique_takes`
with **identical executed Git blob hash** `363a9c494bdbb33be2455896c0095ee6de2d610d`. No database reapplication required.

Verified function permissions:
- `_refund_atomic_booking_payment(uuid,text,text)`: anon=false, authenticated=false, service=true.
- `cancel_recording_session_atomic(uuid,text,text)`: anon=false, authenticated=true.
- `claim_recording_completion(uuid)`, `release_recording_completion(uuid,uuid)`, `finalize_recording_completion(uuid,uuid)`: service=true, anon=false, authenticated=false.
- `idx_songs_unique_source_recording` unique index exists.

**Critical downstream deployment mismatch:** live `complete-recording-sessions` Edge Function version **411**, deployed before the migration, contains **none** of `claim_recording_completion`, `release_recording_completion`, `finalize_recording_completion`, `award_recording_xp_atomic` or `source_recording_session_id`. GitHub `main` `supabase/functions/complete-recording-sessions/index.ts` blob `4091170c3725e68a80e8f04c45389155431ffd1b` **contains all five**. Coordinate tested full Edge Function bundle rollout including `_shared` dependencies, ensure secrets/signature config, retry/cancel/duplicate completion tests, then verify live version and logs. **Do not redeploy migration SQL or start cron manually.**

## Reward system: unsafe migration bodies, canonical XP reconciliation required

| Original Git SQL | Live state / dependency | Verdict |
|---|---|---|
| `20261009190000_process_skill_quest_xp_claim.sql` | RPC absent; depends on nonexistent `profile_action_xp_events` and `xp_ledger` | **Rewrite for canonical wallet/ledger**; do not apply |
| `20261009200000_harden_skill_quest_xp_claim.sql` | Same incompatible dependencies | **Do not apply** |
| `20261009210000_verify_skill_quest_xp_ledger_evidence.sql` | Same incompatible dependencies; validates historical ledger type that does not exist | **Do not apply** |
| `20261013140500_atomic_ap_conversion.sql` | RPC absent; writes to nonexistent `xp_ledger` | **Rewrite**, no direct replay |
| `20261012235600_atomic_video_reward_cooldown.sql` | Table, RPC and cooldown index absent; original calls nonexistent `progression_award_action_xp` and accepts client `p_video_id`, `p_video_name`, `p_skill_slug` without a verifiable completion receipt | **Do not apply as written**. Establish server-verified eligible video and proof-of-watch, then implement canonical ledger/XP award with rate-limiting |
| `20261012235900_atomic_legacy_skill_book_completion.sql` | RPC absent; original calls nonexistent `progression_award_action_xp` | **Rewrite** before enabling book completion |

**Skill quest payout snapshot (read-only):** exactly **23 pending claims totalling 9,200 XP**; all 23 match an existing reward definition and verified quest event, but **all 23 definitions have `enabled=false`**. Exactly **zero pending claims currently have an enabled definition**. Leave status, wallet and definitions unchanged. This is a deliberate payout gate, not authority to backfill. Proposed next slice: use one verified service-only transactional processor on `skill_quest_reward_claims`, `player_xp_wallet`, `experience_ledger`; create unique claim-ledger evidence; fail closed on disabled definitions and pre-existing entries; test staged concurrency/idempotency/rollback; only later explicitly authorize which rewards to enable and pay.

Existing compatible XP functions for reference (not authorization to reuse them blindly): `admin_grant_special_xp_atomic`, `award_daily_activity_xp_atomic`, `award_recording_xp_atomic` write to `player_xp_wallet`, and the first/last also write `experience_ledger`. `increment_profile_xp` instead modifies `profiles.experience`; assess source of truth before combining routes.

## Crafting: partial schema exists, original migration cannot be run intact

`20261012215100_atomic_legacy_crafting.sql` is not installed. Its four functions:
`purchase_crafting_material_atomic`, `start_crafting_session_atomic`,
`collect_crafting_session_atomic`, `salvage_equipment_atomic` are all absent
and are called by `src/hooks/useCraftingSystem.ts`.

Live tables `crafting_materials`, `crafting_recipes`, `crafting_blueprints`,
`player_crafting_materials`, `crafting_sessions`, `equipment_items` and
`player_equipment` exist, and `crafting_materials.base_cost` is integer.
**But `gear_categories` and `equipment_items.gear_category_id` are absent.**
The original collection function refers to both; directly applying the complete original may install broken game-facing RPCs (Postgres resolves many function references only at invocation). Also review server-side price integer overflow, blueprint/skill caps, duplicate completion/salvage, and inventory charge atomicity. Add schema-safe gear foundation in a reviewed forward-only migration first, then test a disposable crafting flow before granting authenticated EXECUTE.

## Other previously reconciled migrations — preserve live replacements

- `20261015090000_atomic_ai_generation_and_recording_xp.sql` exact SQL was installed `20261015103735` (related Edge Function rollout still requires verification).
- `20261013113000_atomic_daily_stipend.sql` safe variant exact SQL applied `20261015095730`.
- `20261012215000_atomic_lottery_client_actions.sql` superseded by production `20261015112035` and `20261015112441`; original references nonexistent `profiles.xp`.
- `20261012232100_idempotent_direct_message_fallback.sql` and destructive legacy gig consequences are superseded; do not rerun.
- `20261014113000_durable_deduped_game_notifications.sql` security/unique-key pieces applied safely in targeted repair `20261015140128`; **generic event triggers not installed**. Do not replay full 17 KB migration; test/plan remaining pieces separately.
- `20300106182000_atomic_chart_entry_notifications.sql` applied exactly as `20261015140711`, service-owned cooldown with RLS and authenticated character-scoped RPC.
- Original professor, quest-ingestion, crew, mayor news, active label marketing, songwriting-instrument and rehearsal functions were found in live `pg_proc`/tables despite original SQL filenames lacking exact migration history; verify deployed definitions before reopening them.

## Remaining ordered direct-to-production plan

1. **Already applied — do not reapply** recording refund/claim/unique-take SQL. Deploy/test new Edge Worker separately. Ensure `generate-song-audio` and `replicate-webhook` versions align with already-installed atomic generation RPCs.
2. **Rewrite and test on staging** canonical XP quest claim processor, preserving disabled reward flags; no payout of 23 pending claims until an explicit separately reviewed activation. Replace AP conversion, video/watch claim and legacy book reward paths against canonical XP ledger.
3. **Dependency-first gear fix** followed by crafting atomic RPCs; do not install broken collection function.
4. **Continue gated** achievement canonical tables, social discovery/DM consent, company recruitment and character/governance atomic transactions, avoiding overwriting already-present versions.
5. **Finance remains blocked:** sponsorship installment and weekly band payroll depend on financial ledger reconciliation; destructive `update_band_balance_from_earnings` SUM trigger still unsafe. Require verified restorable backup, isolated rehearsal and treasury/finance ledger parity; no historical payout replay.

### Data safety

No cash, XP, pending claim status, cron settings, historical recording payment, or player inventory was modified in **this pass**. All findings are based on GitHub main source and live read-only Postgres/Supabase diagnostics. Do not interpret the presence of a function name as a successful runtime/gameplay test.
