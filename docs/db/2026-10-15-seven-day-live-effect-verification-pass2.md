# October 8–15 live migration reconciliation — effect verification, pass 2

**Production:** Supabase `yztogmdixmchsmimtent` (RockMundo). **Date:** 2026-10-15. **Tracker:** #4072.

This follows the full 180-path SQL-content-hash inventory in
[`2026-10-15-seven-day-live-migration-audit.md`](./2026-10-15-seven-day-live-migration-audit.md).
That report establishes history identity and SQL execution hashes; this pass
checks actual production objects and finds safe forward-only replacements.

## Live changes installed this pass

| Production recorded version | Source SQL | Verification |
|---|---|---|
| `20261015140128` | `supabase/production-repairs/20261015_notifications_recipient_guard_and_event_dedupe.sql` (PR #4134, blob `cd91e51a4875cd6ad450b20b80b7b1a72d7b35d4`) | Unique `notifications_event_once_per_character` index exists; `create_notification` retains signature, checks recipient ownership, denies anonymous EXECUTE, supports trusted existing triggers; 1,244 existing notification rows untouched |
| `20261015140711` | `supabase/migrations/20300106182000_atomic_chart_entry_notifications.sql` (blob `94e78f7f702c7c06d0beb87fde8495905f0ac180`) | `create_chart_entry_notification(uuid,uuid)` present, anon EXECUTE false/auth EXECUTE true, `chart_notification_cooldowns` table RLS on; no historical chart alert payout/backfill |

History now contains **1,448** migration entries (1,446 at start of pass). Neither
migration ran cron, produced an XP reward, or replayed historical notifications.
The original 17 KB `20261014113000_durable_deduped_game_notifications.sql`
still has **uninstalled generic trigger/reconciler portions**. Do not replay
the whole file; its authorization and dedupe pieces are now implemented by the
targeted repair.

### Checked live although original names not in migration history

Names below refer to objects verified by querying `pg_proc`, `pg_class`,
`pg_indexes`, and `cron.job` against live production. **Presence is not
proof of exact source version or full functional correctness**.

| Original SQL paths | Verified effect | Decision |
|---|---|---|
| `20261008210000_referral_qualification_character_safety.sql` | `refresh_referral_qualification` RPC exists | No original replay; compare body/permissions |
| `20261009123000_professor_skill_families.sql` | `professor_skill_memberships` table/index and `university_visiting_professor_bonus` function exist | No replay |
| `20261009124500_professor_monthly_rotation.sql`, `20261009171500_professor_monthly_cron.sql` | `rotate_travelling_professors`, internal scheduler, and scheduled monthly cron exist | No replay |
| `20261009174500_professor_arrival_notifications.sql`, `20261009175000_professor_arrival_cron.sql` | Announcement function, unique arrival index and scheduled cron exist | No replay |
| `20261009175500_professor_bonus_permissions.sql`, `20261009170000_professor_atomic_attendance_bonus.sql` | Professor bonus and university attendance RPCs exist | Compare ACLs and body first |
| `20261009130000_gig_skill_quest_ingestion.sql`, `20261009140000_correct_gig_quest_performers.sql`, `20261009140000_gig_skill_quest_confirmed_performers.sql` | `record_completed_gig_skill_quest` exists | Three versions target one function; no replay |
| `20261009134045_band_require_all_crew_for_gigs.sql` | Five expected crew-sync/assignment functions exist | No replay; inspect current behavior |
| `20261009170000_mayor_news_columns.sql` | Table and its city/published index exist | No replay |
| `20261010180500_secure_book_reading_cron.sql` | `daily-book-reading-attendance` job is active | Do not reschedule without Edge authorization review |
| `20261012213000_song_generation_prediction_correlation.sql`, `20261012235500_song_generation_attempt_prediction_tracking.sql` | Both named indexes and `prediction_id`, `provider_prediction_id`, `triggered_by_user_id` columns exist | No replay |
| `20261012225300_canonical_active_label_marketing.sql` | `create_label_promotion_campaign` exists | Financial behavior needs DDL comparison; no replay |
| `20261013000100_authoritative_songwriting_instrument_bonus.sql` | Both instrument-aware completion functions exist | No replay |
| `20261013073500_atomic_songwriting_pause.sql` | `pause_songwriting_session_atomic` exists; exact SQL also recorded previously under short name | Already applied |
| `20261013125000_admin_atomic_xp_grants.sql` | `admin_grant_special_xp_atomic` exists and is from later hardened deployment | Original superseded |
| `20261013195000_public_profile_visibility_and_badges.sql`, `20261013210000_social_discovery_authoritative_viewer.sql`, `20261013210100_private_discovery_filters_and_sorting.sql` | `get_public_profile_detail`, `search_public_profiles`, `search_player_discovery` exist in some form, but **canonical dependencies absent** | Not proof of valid deployment; gated |
| `20300106181000_character_scoped_notification_archive.sql` | `notification_profile_states` table, index and RPC exist following inbox restore | Superseded by existing production repair |
| `20300106210000_rehearsal_booking_full_intent_idempotency.sql` | `confirm_rehearsal_booking_atomic` exists | Compare function contract; no replay |

## Genuine missing objects / must repair before direct application

| Priority | Original migration(s) | Live evidence | Safe next step |
|---|---|---|---|
| P1 | `20261009190000_process_skill_quest_xp_claim.sql`, `20261009200000_harden_skill_quest_xp_claim.sql`, `20261009210000_verify_skill_quest_xp_ledger_evidence.sql` | **RPC absent**; **23 pending XP claims totalling 9,200 XP**; `xp_ledger` and `profile_action_xp_events` absent | **Do not execute or pay claims.** Build canonical `experience_ledger` + `player_xp_wallet` transaction with verified quest evidence, strict unique claim key and concurrency tests; review existing actions before controlled payout |
| P1 | `20261013140500_atomic_ap_conversion.sql` | `convert_ap_to_sxp_atomic` absent; `xp_ledger` absent | Rewrite against canonical wallet/ledger; test XP/AP conservation and rollback |
| P1 | `20261012215100_atomic_legacy_crafting.sql` | Four crafting RPCs absent; `gear_categories` absent | Add compatible gear foundation, check inventory/recipe columns, test purchases, collection, salvage and duplicate settlement |
| P1 | `20261012235600_atomic_video_reward_cooldown.sql` | `education_video_reward_claims` table/index and `reward_education_video_atomic` absent | Review server reward validation and watch evidence before controlled grant rollout |
| P1 | `20261012232200_atomic_underworld_transactions.sql`, `20261013170000_underworld_purchase_arrest.sql` | Purchase/consume RPCs and arrest trigger function absent | Validate official item costs, event consequences, prison schema, and atomic account/inventory writes |
| P1 | `20261013100000_atomic_band_leadership.sql`, `20261013161500_atomic_band_leave.sql`, `20300106190000_harden_band_governance_profile_identity.sql` | Atomic leadership, leave and disband RPCs absent; governance triggers absent | Reconcile band member profile-vs-user IDs; migrate callers and test band continuity |
| P1 | `20261013155000_atomic_character_recovery.sql`, `20261013170000_atomic_retirement_finalization.sql` | Recovery and retirement RPCs absent | Preflight inheritance/reset/history schema and isolation; test with synthetic characters only |
| P1 | `20261013184000_achievement_event_reward_integrity.sql` | Both idempotency tables and 3 criteria/reward functions absent; canonical `achievement_criteria`, `achievement_rewards`, `achievement_events` absent | Install canonical foundations in tested order; avoid retroactive rewards |
| P2 | `20261013201000_private_friend_suggestions_mutual_counts.sql` | `get_safe_friend_suggestions`, `get_mutual_friend_counts` absent | Depends on missing player social-identity foundations; validate RLS |
| P2 | `20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql` | `can_profile_receive_dm` and direct-message consent trigger absent; other friendship RPCs already exist | Test previous player privacy foundation with multiple characters; do not overwrite active friendship RPCs blindly |
| P2 | `20300106170000_repair_band_recruitment_capacity_applications_expiry.sql`, `20300106180000_correct_recruitment_approvals_and_departures.sql` | Capacity/expiration/departure functions missing but application/create/respond functions exist | Prepare merge-safe partial migration and stale-vacancy tests; do not replace all recruitment functions at once |
| P2 | `20300106201000_controlled_random_event_backlog_reconciliation.sql` | Service reconciliation function/audit table absent | Add diagnostics on staging, never replay prior event consequences directly |
| Blocked finance | `20261012213100_atomic_sponsorship_installments.sql`, `20300106200000_secure_atomic_weekly_band_payroll.sql` | Earnings SUM trigger and player/band/finance ledger drift from prior audits; payroll RPC/table absent | PITR restore rehearsal and sandbox reconciliation before touching wages/treasury |
| Blocked economics | `20261012225000_atomic_business_hiring_upgrades.sql`, `20261012230500_atomic_subsidiary_purchases.sql` | Untrusted client-supplied purchase cost risk in originals | Server-priced forwards-only purchases and RLS validation; no original replay |

## Superseded or incompatible originals

- `20261012230900_atomic_songwriting_skip_completion.sql`: its non-instrument `skip_and_complete_songwriting_project` RPC absent; **instrument-aware** `skip_and_complete_songwriting_project_with_instruments` already exists, as does a later songwriting-completion compatibility repair. Do not install obsolete overload without frontend call audit.
- `20261012232100_idempotent_direct_message_fallback.sql`: superseded by Oct 14 live DM RPC repair.
- `20261012215000_atomic_lottery_client_actions.sql`: superseded by `20261015112035` and `20261015112441`; original attempted to write nonexistent `profiles.xp`.
- `20261008193206_idempotent_gig_consequences.sql`: superseded by non-destructive canonical gig processing fixes.
- `20261014113000_durable_deduped_game_notifications.sql`: original recipient RPC + dedupe index portion superseded; generic trigger/event reconciler portions still absent, require independent review.
- `20300106182000_atomic_chart_entry_notifications.sql`: **installed as-is with correct live dependencies** in this pass.
- Original progress/XP files referencing the absent `xp_ledger` or `profile_action_xp_events` must be **rewritten** rather than treated as ready to apply.

## Security and operational verification

The Supabase security advisor after both deployments reports 119 RLS-enabled tables without a policy (the new chart cooldown is deliberately service/function-only), one pre-existing SECURITY DEFINER view, 642 anonymous-definer-function warnings, and 1,063 authenticated-definer warnings. These are broad audit findings, not evidence that all flagged functions are exploitable.

The 4 historical recording notifications with account/profile mismatch remain **unaltered**, as do all player balances, skill XP, quest claims, chart data and cron schedules.

**Next order:** (1) diagnose quest-claim XP pipeline + audit the 23 pending claims; (2) legacy crafting/gear foundation dependency review; (3) video cooldown source and XP award authority; (4) player social canonical foundation and consent/recruitment; (5) staging/PITR finance work. Do **not** run `supabase db push` on the 7-day SQL directory.
