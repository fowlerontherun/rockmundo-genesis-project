# RockMundo live migration reconciliation — pass 4, 15 October 2026

Issue: [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072). Supabase project: `yztogmdixmchsmimtent`. See the [full Oct 8–15 filename/SQL audit](2026-10-15-seven-day-live-migration-audit.md), [effect audit](2026-10-15-seven-day-live-effect-verification-pass2.md), and [pass 3](2026-10-15-seven-day-migration-reconciliation-pass3.md).

**Scope:** direct read-only production comparison of the latest SQL history, Git trees, function ACLs, indices, RLS, cron job metadata (never stored cron commands), Edge Function code references, and current record counts. Do not use this report as an automatic db-push manifest.

## New facts since pass 3

- Production migration history rose from **1,449 to 1,467** (**18 executed migrations**).
- The GitHub **`supabase/migrations` tree is unchanged** at Git tree `fe173da71e86cb6e9238594f70158149f2962160` (1,926 SQL files). The newly applied changes are in `supabase/production-repairs` or direct production history.
- **12** of the 18 entries have an **exact byte-for-byte Git blob hash match** to a current production-repair SQL file on main.
- **6** were applied but their exact SQL was missing from the `main` production-repairs directory. Recovered exact SQL text from `supabase_migrations.schema_migrations.statements` into **PR #4150**. Every one of six recovered files has been re-fetched and independently matched to the executed Git object hash. These statements must **NOT** be reapplied.
- The current Supabase Security Advisor no longer lists a `security_definer_view` ERROR; the `festival_lineup_view_rls_invoker` migration is source-matched and recorded. Existing 119 RLS-enabled/no-policy INFO notices and 638 anonymous-definer-function executable WARN notices still need broader targeted audit.

## All 18 newly executed migrations, exact content, and decisions

All versions below were **already applied** by other live work before this audit turn. **No replay**.

| Applied UTC migration version | Recorded migration name suffix after `rockmundo_20261015_` | Executed Git SQL hash | Source and decision |
|---|---|---|---|
| `20261015152936` | `music_notifications_durable_reconcile_compat` | `16081665c1dee906a839585f255babad0f005fec` | Main production-repair SQL; already deployed, no replay |
| `20261015153229` | `ap_to_sxp_conversion_live_ledger_compat` | `c53e49920ee2af26707c91d27c5b735d60b5062b` | Main exact SQL; `convert_ap_to_sxp_atomic` now exists, authenticated-only; original `20261013140500_atomic_ap_conversion.sql` superseded |
| `20261015153459` | `durable_invite_release_gig_offer_notifications` | `0f5fc465f88cc703ebb74b3288d2998eeffba360` | Main exact SQL; already deployed |
| `20261015154951` | `education_video_reward_live_schema_compat` | `3fac7e36ec95d2d9d35dfb73d056bba8dde0e4e3` | Main exact SQL; `reward_education_video_atomic` now exists/authenticated-only, claims table/index RLS; original `20261012235600` superseded |
| `20261015155319` | `legacy_skill_book_inventory_write_lock` | `5b0999dad50e7d561638f8fa476ea2807d84ec2a` | Main exact SQL; direct player skill-book inventory UPDATE denied; **legacy skill-book completion RPC still missing** |
| `20261015160344` | `crafting_raw_inventory_write_lock` | `782a1fdb9114b0bf117381b55536babc983a951d` | Main exact SQL; authenticated direct INSERT/UPDATE/DELETE for crafting-material inventory denied |
| `20261015160409` | `festival_lineup_view_rls_invoker` | `bc769e7f162775fea8d4c5687022f09d88acc1da` | Main exact SQL; no new security-definer view linter ERROR |
| `20261015160702` | `atomic_legacy_crafting_live_compat` | `9d72119d428c7c4d20fe03128e4339f175d41de6` | Main exact SQL; all four crafting atomic RPCs now installed; original `20261012215100_atomic_legacy_crafting.sql` superseded because it referenced absent gear category schema |
| `20261015161928` | `crafting_tiered_skill_eligibility_live_compat` | `020ce5ea67336cb21f02ca4bcca699f092bb0247` | Main exact SQL; crafting skill eligibility correction applied after atomic crafting |
| `20261015162606` | `band_governance_profile_scoped_compat` | `d3950c2e794b5ac49637c2b7fbf7c90254f33950` | Main exact SQL; leadership transfer, leave, disband and direct governance guard RPCs/triggers installed |
| `20261015163018` | `privacy_safe_mutual_friend_counts` | `050c66ff6e643e241baae1e5c51ff0d99551c816` | Main exact SQL; `get_mutual_friend_counts` installed |
| `20261015163051` | `mutual_friend_counts_unnest_fix` | `4a8c6131dcdc678b8d33df542d269bb41e3bbdd5` | Main exact SQL, supersedes first mutual-count function implementation |
| `20261015164048` | `social_visibility_band_members_enum_compat` | `4efda6e8f1693ede6244571295200e1e525b89b8` | **Restored exact SQL in PR #4150** |
| `20261015164122` | `private_social_profile_editor_foundation` | `aae0c0581bc83fb723e48d2c7cb6db0891023076` | **Restored exact SQL in PR #4150**; `player_profiles` exists with **zero rows** (opt-in privacy default, no forced publication/backfill) |
| `20261015164212` | `opt_in_private_friend_suggestions_compat` | `c0ffeb15ee67d82a5e97592a20ec9753d21d1178` | **Restored exact SQL in PR #4150**; authenticated `get_safe_friend_suggestions` exists |
| `20261015164531` | `band_recruitment_safe_partial_compat` | `16de9a238fb1f78172319d4d36503a4fbe540e3c` | **Restored exact SQL in PR #4150**; capacity/expiry functions and general-band pending unique index exist; do not replay historical 2030-dated recruitment batch |
| `20261015164731` | `band_vacancy_expiry_cron_live_compat` | `9eb16f895d42d40d6ca1ba10ceace5f2b4a84f64` | **Restored exact SQL in PR #4150**; `rockmundo-band-vacancy-expiry` cron active every 15 minutes |
| `20261015165135` | `social_discovery_opt_in_privacy_gate` | `cca6b4503ab87b9bbb6aa5f86b14e33fa9fba79d` | **Restored exact SQL in PR #4150**; authenticated `get_public_profile_detail`, `search_public_profiles`, `search_player_discovery` exist |

## Original Oct 8–15 migration files now superseded / no longer suitable to reapply

- `20261013140500_atomic_ap_conversion.sql`: canonical live-wallet compatible conversion installed above. Original references nonexistent `xp_ledger`.
- `20261012235600_atomic_video_reward_cooldown.sql`: compatible server catalog-validated reward and idempotent cooldown already installed; historical original references nonexistent `progression_award_action_xp`.
- `20261012215100_atomic_legacy_crafting.sql`: four RPCs already installed with live-compatible inventory/equipment schema and subsequent tiered skill correction. Original references `gear_categories` and `equipment_items.gear_category_id`, still absent.
- `20261013100000_atomic_band_leadership.sql`, `20261013161500_atomic_band_leave.sql` and `20300106190000_harden_band_governance_profile_identity.sql`: corrected live profile-scoped band governance is installed. Do not replace it with earlier partial functions.
- `20261013201000_private_friend_suggestions_mutual_counts.sql`: friend suggestions and mutual counts now covered by a newer privacy-safe, opt-in implementation + unnest correction.
- `20261013210000_social_discovery_authoritative_viewer.sql` and `20261013210100_private_discovery_filters_and_sorting.sql`: opt-in gate live; the historical originals may publish or expose data under different foundation assumptions. Do not replay.
- `20300106170000_repair_band_recruitment_capacity_applications_expiry.sql`: compatible partial application and interval cron live. Do not replay full source.
- `20261014113000_durable_deduped_game_notifications.sql`: selective compatibility repairs installed (recipient security, event dedupe, durable core/music/offer/invite notifications). **Some generic historical event-triggers/reconciliation code may remain intentionally uninstalled.** Do not replay all trigger creations.
- `20261012215000_atomic_lottery_client_actions.sql`: previously superseded by direct lottery repair `20261015112035` and draw authorization guard `20261015112441`.
- The **new** `20261015124500_recording_refund_claims_and_unique_takes.sql` has exact recorded SQL in production (`20261015151606`), so no replay.

## Still needs new, dependency-aware SQL — NOT blanket application

| Priority | Migration / workstream | Live evidence and safe requirement |
|---|---|---|
| P1 | `20261009190000`, `20261009200000`, `20261009210000` quest XP payout processor | `process_skill_quest_xp_claim` **absent**; **23 pending XP claims = 9,200 XP** and **zero** eligible/enabled. `xp_ledger` and `profile_action_xp_events` absent. Implement canonical `player_xp_wallet`+`experience_ledger` service-only processor with ledger claim uniqueness, idempotency, and staging rollback/concurrency tests. Do not activate definitions or pay historical claims during deployment. |
| P1 | `20261012235900_atomic_legacy_skill_book_completion.sql` | `complete_legacy_skill_book_atomic` absent and old SQL calls nonexistent `progression_award_action_xp`; legacy inventory direct UPDATE is now locked. Need compatible canonical XP + completion transaction. |
| P1 | Education video proof-of-watch strengthening | The installed video RPC **does** check catalog membership, character ownership, eligibility, cooldown, XP ledger and wallet; but **does not verify actual video viewing time/completion**. Video claim table has **0 new claims**; historical `experience_ledger` includes **324** `youtube_video` rows from earlier implementations. Do not backfill or replay old awards. Issue a signed server eligibility/attendance receipt before trusted payouts. |
| P1 | `20261013184000_achievement_event_reward_integrity.sql` | Canonical `achievement_criteria`, `achievement_events` and `achievement_rewards` remain missing; event/settlement guards cannot be installed in isolation. |
| P1 | `20261012232200_atomic_underworld_transactions.sql` and `20261013170000_underworld_purchase_arrest.sql` | Buy/consume RPCs and purchase arrest trigger absent. Validate canonical inventory/purchase/arrest ledger and fixed server-side prices. |
| P1 | `20261013155000_atomic_character_recovery.sql`, `20261013170000_atomic_retirement_finalization.sql` | Recovery/retirement RPCs absent; validate character lifecycle and inheritance effects. |
| P2 | `20261012225000_atomic_business_hiring_upgrades.sql`, `20261012230500_atomic_subsidiary_purchases.sql` | Original client-provided price/cost risk. Rewrite to server-authoritative catalog pricing. |
| P2 | `20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql` | DM consent gate may still be absent; do not blindly replace live RPCs. Privacy-safe social profile and opt-in discovery foundations now exist, so review remaining DM write paths against them. |
| Finance-blocked | `20261012213100_atomic_sponsorship_installments.sql`, `20300106200000_secure_atomic_weekly_band_payroll.sql`, `20261015_incremental_band_earnings_trigger.sql` | `update_band_balance_from_earnings` still includes `SUM(amount)`; authenticated direct `band_earnings` INSERT still possible. 44,882 earnings; 31 current primary band treasuries agree with displayed band balances, but this does not reconcile financial accounts or future writes. **No bulk trigger replay, cron payout, payroll, or sponsorship cutover** until restorable PITR + isolated accounting tests. |

## Edge Function deployment status updated

Production `complete-recording-sessions` is now **v413** (previous pass saw v411). Its currently deployed source references all five SQL cutover symbols:
`claim_recording_completion`, `release_recording_completion`,
`finalize_recording_completion`, `award_recording_xp_atomic` and
`source_recording_session_id`. GitHub main has these references too.
The previously documented worker/database **code-reference mismatch is resolved**;
a real recording session end-to-end smoke test is still required.
Do **not** reinstall the recording SQL or retrigger completed sessions to test.

## Post-audit / rollback gates

No new live migration was executed **during pass 4**. The six new source files
are copies of **already executed production** SQL, not deploy instructions.
CI and GitHub review of PR #4150 must complete before treating source-control
reconciliation as merged.

For any newly authored SQL: verify the complete live schema and grants,
prepare PITR/restore/staging rehearsal for any funds/XP/backfill operations,
test concurrency/retry/fail-closed behavior and role isolation,
record only the exact reviewed statements with a unique database history version,
and verify live outcomes without executing historical payers or user activity.
