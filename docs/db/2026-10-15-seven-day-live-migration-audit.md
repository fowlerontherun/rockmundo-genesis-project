# RockMundo — 7-day migration reconciliation (October 8–15, 2026)

Tracking: [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).
**Read-only reconciliation report. Do not use this file as a db-push queue or migration approval.**

## Scope and methodology

- Production: Supabase `yztogmdixmchsmimtent` (eu-west-2).
- Baseline: last main-branch commit before 2026-10-08 11:22 UTC, `07c9bace88713e4be8165e298b371d588c62ff07` (committed 07:08 UTC). Latest reviewed `main` migrations subtree: `a482a951a5924640ab7368244a4f30e6bc32f5be`.
- Compared **Git tree blob hashes** for `supabase/migrations/*.sql` in the two snapshots. The filename's embedded date is not treated as its creation date.
- Queried all **1446 live records** from `supabase_migrations.schema_migrations`. Each record contains one SQL statement. For each, computed Git's canonical SHA-1 object ID from PostgreSQL's stored UTF-8 SQL (`blob <byte_count>\\0<sql>`) using `extensions.digest`. A SHA match proves **that exact SQL text was recorded as executed**, even under a different migration name. A matching name with a differing hash does NOT prove the current Git SQL was executed.
- Classifications record historical execution only: subsequent `CREATE OR REPLACE`, permission changes, cron cutovers, and migrations can supersede the effect. Live schema validation is still mandatory before any replacement.

## Totals

| Metric | Count |
|---|---:|
| SQL files at baseline | 1787 |
| SQL files at reviewed head | 1925 |
| Added paths | 180 |
| Of which byte-for-byte renames | 40 |
| Genuinely new SQL bodies | 140 |
| Modified existing SQL paths | 5 |
| Removed paths | 42 |
| Removals not accounted for by renames | 2 |
| Added paths with exact SQL recorded | 31 |
| Added paths with name match but different SQL | 55 |
| Added rename paths with no history match | 38 |
| Added paths without SQL/name history match | 56 |
| Production migration history records | 1446 |

## Immediate safe decisions

**No further migration should be run merely because its original file timestamp or basename has no production history identity.**

1. **Applied; do not replay:** `20261015090000_atomic_ai_generation_and_recording_xp.sql` exact Git content was applied as `20261015103735`; likewise `20261013113000_atomic_daily_stipend.sql` was applied under a safe suffix. Social-privacy foundation (`20261015110345`), lottery payout and ticket RPC reconciliation (`20261015112035`), and lottery draw RLS guard (`20261015112441`) are source-controlled under `supabase/production-repairs` and already applied. These repairs are not new `migrations/` filenames in this manifest.
2. **Already has live core effects, reconcile identities rather than replay:** daily passive growth ledger/RPC/cron, travelling professor tables, university attendance, atomic book day and reader cron, generation prediction tracking indexes/columns, admin XP grant RPC, instrument songwriting functions, random event RPC, songwriting pause RPC. The manifest below shows original file history and explanatory notes where checked. Full statement-by-statement equality is **not** guaranteed unless hash matched.
3. **Explicitly superseded/unsafe historical SQL:** `20261008193206_idempotent_gig_consequences.sql`, `20261012232100_idempotent_direct_message_fallback.sql`, and `20261012215000_atomic_lottery_client_actions.sql`. Use the recorded guarded production replacements, never these original paths.
4. **Next direct-to-DB candidates only after targeted review:** `20261014113000_durable_deduped_game_notifications.sql` needs a **narrow** compatibility/uniqueness repair, not blind wholesale replacement: the index is missing and current duplicate event keys are zero, but `create_notification` is live and the file replaces privileged functions. Other unrecorded professor, quest, underworld, referral and XP migration paths need source-by-source dependency tests.
5. **Blocked:** sponsorship installments/old earnings trigger, weekly payroll and ledger mismatch, arbitrary purchase costs in subsidiary and business purchases, AP conversion referencing absent `xp_ledger`, canonical achievements/social profile tables, 2030-dated social/governance/payroll migration cluster. Run PITR restore rehearsal and staging transaction/concurrency tests before financial cutovers. No historical payouts, cron reruns or `db push`.

## Additional live preflight evidence

- `public.xp_ledger` absent; `convert_ap_to_sxp_atomic` absent: original AP conversion SQL would reference a missing ledger.
- `notifications_event_once_per_character` index absent, while current `notifications` have **zero duplicate** populated `event_key` groups.
- `achievement_criteria`, `achievement_rewards`, `achievement_events`, `achievement_processed_events`, `achievement_reward_settlements`, `player_profiles`, `profile_badges` absent. Do not apply late-stage achievement or social-profile functions.
- Legacy `update_band_balance_from_earnings()` still uses `SUM(amount)` and has dangerous financial implications; payroll and sponsorship remain blocked. Direct `band_earnings` inserts remain possible for authenticated band members with an RLS membership guard, but no server-authoritative amount guard; frontend currently includes direct writers, so coordinated refactor is required.
- The AI database migration is installed but the four relevant Edge Functions were found on older builds in the previous live check.
- 13 new-content timestamp-collision groups remain among current SQL paths, including a `20300106200000` collision: never run by filename order alone.

## Full changed-file classification (180 added paths)

The SQL hash is stronger than name history, but not stronger than a later schema replacement.
“Name match; SQL differs” **means deployment drift**, not “applied/current”.

| File added since baseline | Source/history status | Matching live migration identity (when found) | Live check or action |
|---|---|---|---|
| `20260316093001_fix_promotional_campaigns_rls.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260710120001_beta_admin_support_tools.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260710120002_complete_company_recruitment_lifecycle.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120001_gig_audience_participation.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120002_gig_live_outcome_breakdown.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120003_recording_outcome_breakdown.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120004_songwriting_outcome_calculator.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120005_tour_operations_multi_gig_management.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120006_wellness_accommodation_travel_recovery.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712120007_wellness_professionals.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260712143001_wellness_time_away_longevity.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713090001_create_balance_management_registry.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713090002_player_progression_analytics.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713120001_progression_achievements_canonical.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713120002_repair_songwriting_optional_columns.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713130001_fix_skill_xp_spending.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713130002_player_discovery_search_matchmaking.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260713193001_private_messaging_conversations.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260717120001_finance_phase2_player_band_management.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260717153001_harden_festival_creation_phase1_forward.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260720120001_repair_london_fixture_operations_projection.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260721120001_repair_banking_dashboard_rpc.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260728120001_fix_gig_booking_band_fame.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260728120002_reconcile_player_cash_finance.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260728130001_replace_legacy_gig_travel_trigger.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260728140001_fix_podcast_submission_membership_check.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260728150001_submit_podcast_appearance_rpc.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260825101501_support_band_tour_matching.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260825145501_song_live_and_cover_stats.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260906193001_record_stock_label_marketing.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260907070001_major_event_invitation_application_flow.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260910170501_band_clothing_performance_bonus.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260921100001_add_show_type_to_gigs_and_tour_venues.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260922100001_update_player_skills_baseline.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20260922110001_rebalance_label_marketing_reach.sql` | EXACT SQL executed | `20260922120527 rebalance_label_marketing_reach` | Review source prerequisites and current live DDL before applying |
| `20260922110002_split_player_skills_attributes.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20261007154501_referral_campaign_attribution.sql` | EXACT SQL executed | `20261007154704 referral_campaign_attribution` | Review source prerequisites and current live DDL before applying |
| `20261008180000_twaater_referral_publication_audit_hardening.sql` | EXACT SQL executed | `20261008170946 twaater_referral_publication_audit_hardening` | Review source prerequisites and current live DDL before applying |
| `20261008193206_idempotent_gig_consequences.sql` | No recorded SQL/name | — | Superseded by non-destructive production gig repair; DO NOT run |
| `20261008210000_referral_qualification_character_safety.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261008211500_referral_vip_character_safety.sql` | EXACT SQL executed | `20261008194516 referral_vip_character_safety` | Review source prerequisites and current live DDL before applying |
| `20261008213000_referral_reward_living_character.sql` | EXACT SQL executed | `20261008195402 referral_reward_living_character` | Review source prerequisites and current live DDL before applying |
| `20261008214500_referral_claim_boundary.sql` | EXACT SQL executed | `20261008195549 referral_claim_boundary` | Review source prerequisites and current live DDL before applying |
| `20261008220000_share_analytics_phase1.sql` | EXACT SQL executed | `20261008200002 share_analytics_phase1` | Review source prerequisites and current live DDL before applying |
| `20261008223000_twaater_share_publication_receipts.sql` | EXACT SQL executed | `20261008201908 twaater_share_publication_receipts` | Review source prerequisites and current live DDL before applying |
| `20261008225500_referral_profile_name_column_repair.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009090000_skill_quest_events.sql` | Name match; SQL differs | `20261014064050 rockmundo_20261009090000_skill_quest_events` | Review source prerequisites and current live DDL before applying |
| `20261009100000_songwriting_skill_quest_trigger.sql` | Name match; SQL differs | `20261014064258 rockmundo_20261009100000_songwriting_skill_quest_trigger` | Review source prerequisites and current live DDL before applying |
| `20261009110000_recording_skill_quest_trigger.sql` | Name match; SQL differs | `20261014064300 rockmundo_20261009110000_recording_skill_quest_trigger` | Review source prerequisites and current live DDL before applying |
| `20261009111500_daily_passive_skill_growth.sql` | EXACT SQL executed | `20261009103507 daily_passive_skill_growth` | Ledger, RPC and scheduled cron live |
| `20261009113000_seed_comical_skill_xp_events.sql` | EXACT SQL executed | `20261009112056 seed_comical_skill_xp_events` | Review source prerequisites and current live DDL before applying |
| `20261009120000_luthiery_skill_quest_trigger.sql` | Name match; SQL differs | `20261014064302 rockmundo_20261009120000_luthiery_skill_quest_trigger` | Review source prerequisites and current live DDL before applying |
| `20261009121500_travelling_professors_phase1.sql` | EXACT SQL executed | `20261009130542 travelling_professors_phase1` | Core tables and view live |
| `20261009122000_idempotent_comical_event_skill_xp.sql` | EXACT SQL executed | `20261009112059 idempotent_comical_event_skill_xp` | Review source prerequisites and current live DDL before applying |
| `20261009123000_professor_skill_families.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009124500_professor_monthly_rotation.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009130000_atomic_random_event_outcomes.sql` | EXACT SQL executed | `20261009112101 atomic_random_event_outcomes` | Atomic event RPC live |
| `20261009130000_gig_skill_quest_ingestion.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009134000_atomic_random_event_delivery.sql` | EXACT SQL executed | `20261009112104 atomic_random_event_delivery` | Review source prerequisites and current live DDL before applying |
| `20261009134045_band_require_all_crew_for_gigs.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009140000_correct_gig_quest_performers.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009140000_gig_skill_quest_confirmed_performers.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009150000_gig_quest_performer_confirmation.sql` | Name match; SQL differs | `20261014064646 rockmundo_20261009150000_gig_quest_performer_confirmation` | Review source prerequisites and current live DDL before applying |
| `20261009150000_secure_random_event_choices.sql` | EXACT SQL executed | `20261009112106 secure_random_event_choices` | Review source prerequisites and current live DDL before applying |
| `20261009151000_prevent_empty_random_skill_rewards.sql` | EXACT SQL executed | `20261009112110 prevent_empty_random_skill_rewards` | Review source prerequisites and current live DDL before applying |
| `20261009160000_atomic_university_and_passive_reconcile.sql` | EXACT SQL executed | `20261009103513 atomic_university_and_passive_reconcile` | University attendance RPC live |
| `20261009160000_skill_quest_reward_claims.sql` | Name match; SQL differs | `20261014064053 rockmundo_20261009160000_skill_quest_reward_claims` | Review source prerequisites and current live DDL before applying |
| `20261009162000_expire_ineligible_skill_reward_events.sql` | EXACT SQL executed | `20261009112112 expire_ineligible_skill_reward_events` | Review source prerequisites and current live DDL before applying |
| `20261009170000_mayor_news_columns.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009170000_professor_atomic_attendance_bonus.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009170000_skill_quest_reward_definitions.sql` | Name match; SQL differs | `20261014064056 rockmundo_20261009170000_skill_quest_reward_definitions` | Review source prerequisites and current live DDL before applying |
| `20261009171500_professor_monthly_cron.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009173000_legacy_random_event_resolution_ledger.sql` | EXACT SQL executed | `20261009120058 legacy_random_event_resolution_ledger` | Review source prerequisites and current live DDL before applying |
| `20261009173000_professor_api_read_grants.sql` | EXACT SQL executed | `20261009130615 professor_api_read_grants` | Review source prerequisites and current live DDL before applying |
| `20261009174500_professor_arrival_notifications.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009175000_professor_arrival_cron.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009175500_professor_bonus_permissions.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009180000_professor_write_permissions.sql` | EXACT SQL executed | `20261009130628 professor_write_permissions` | Review source prerequisites and current live DDL before applying |
| `20261009180000_skill_quest_reward_claim_enqueue.sql` | Name match; SQL differs | `20261014070536 rockmundo_20261009180000_skill_quest_reward_claim_enqueue` | Review source prerequisites and current live DDL before applying |
| `20261009183500_atomic_random_event_assignment.sql` | EXACT SQL executed | `20261009122314 atomic_random_event_assignment` | Review source prerequisites and current live DDL before applying |
| `20261009190000_process_skill_quest_xp_claim.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009200000_harden_skill_quest_xp_claim.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009210000_guard_skill_quest_experience_ledger.sql` | Name match; SQL differs | `20261014070527 rockmundo_20261009210000_guard_skill_quest_experience_ledger` | Review source prerequisites and current live DDL before applying |
| `20261009210000_verify_skill_quest_xp_ledger_evidence.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261009211000_fix_skill_quest_claim_null_guard.sql` | Name match; SQL differs | `20261014070530 rockmundo_20261009211000_fix_skill_quest_claim_null_guard` | Review source prerequisites and current live DDL before applying |
| `20261009212000_bind_quest_claims_to_experience_ledger.sql` | Name match; SQL differs | `20261014070533 rockmundo_20261009212000_bind_quest_claims_to_experience_ledger` | Review source prerequisites and current live DDL before applying |
| `20261010180500_secure_book_reading_cron.sql` | No recorded SQL/name | — | Matching named cron currently active; verify Edge authorization |
| `20261010181500_correct_discord_invite.sql` | Name match; SQL differs | `20261014103114 rockmundo_20261010181500_correct_discord_invite_production_reconcile` | Review source prerequisites and current live DDL before applying |
| `20261010192000_atomic_book_reading_day.sql` | EXACT SQL executed | `20261010181739 atomic_book_reading_day` | Atomic recording RPC exists |
| `20261010210500_atomic_skill_book_purchases.sql` | Name match; SQL differs | `20261014070838 rockmundo_20261010210500_atomic_skill_book_purchases` | Review source prerequisites and current live DDL before applying |
| `20261012213000_song_generation_prediction_correlation.sql` | No recorded SQL/name | — | Live columns/indexes exist; reconcile without replay |
| `20261012213100_atomic_sponsorship_installments.sql` | No recorded SQL/name | — | Pending; earnings trigger and ledger/PITR gates |
| `20261012213200_collaboration_inviter_character.sql` | Name match; SQL differs | `20261014064527 rockmundo_20261012213200_collaboration_inviter_character` | Review source prerequisites and current live DDL before applying |
| `20261012213300_enchantment_ownership_skill_checks.sql` | Name match; SQL differs | `20261014094559 rockmundo_20261012213300_enchantment_ownership_skill_checks` | Review source prerequisites and current live DDL before applying |
| `20261012215000_atomic_lottery_client_actions.sql` | No recorded SQL/name | — | Replacement live lottery repairs 20261015112035 + 20261015112441; original incompatible with profiles.xp |
| `20261012215100_atomic_legacy_crafting.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261012223000_atomic_stream_totals.sql` | Name match; SQL differs | `20261014102747 rockmundo_20261012223000_atomic_stream_totals` | Review source prerequisites and current live DDL before applying |
| `20261012223500_atomic_housing_city_laws.sql` | Name match; SQL differs | `20261014102445 rockmundo_20261012223500_atomic_housing_city_laws` | Review source prerequisites and current live DDL before applying |
| `20261012225000_atomic_business_hiring_upgrades.sql` | No recorded SQL/name | — | Pending; verify all server-authoritative price/cost paths |
| `20261012225100_atomic_label_legal_services.sql` | Name match; SQL differs | `20261014112042 rockmundo_20261012225100_atomic_label_legal_services` | Review source prerequisites and current live DDL before applying |
| `20261012225200_authoritative_label_counteroffers.sql` | Name match; SQL differs | `20261014102448 rockmundo_20261012225200_authoritative_label_counteroffers` | Review source prerequisites and current live DDL before applying |
| `20261012225300_canonical_active_label_marketing.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261012230000_character_slot_redemption_atomic.sql` | EXACT SQL executed | `20261013061217 character_slot_redemption_atomic` | Review source prerequisites and current live DDL before applying |
| `20261012230500_atomic_subsidiary_purchases.sql` | No recorded SQL/name | — | Blocked: client-submitted value/cost |
| `20261012230600_atomic_housing_purchases_leases.sql` | Name match; SQL differs | `20261014102442 rockmundo_20261012230600_atomic_housing_purchases_leases` | Review source prerequisites and current live DDL before applying |
| `20261012230700_atomic_personal_band_vehicles.sql` | Name match; SQL differs | `20261014121120 rockmundo_20261012230700_atomic_personal_band_vehicles` | Review source prerequisites and current live DDL before applying |
| `20261012230800_atomic_manual_work_clockin.sql` | Name match; SQL differs | `20261014101523 rockmundo_20261012230800_atomic_manual_work_clockin` | Review source prerequisites and current live DDL before applying |
| `20261012230900_atomic_songwriting_skip_completion.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261012231000_immutable_christmas_winner_history.sql` | Name match; SQL differs | `20261014071020 rockmundo_20261012231000_immutable_christmas_winner_history` | Review source prerequisites and current live DDL before applying |
| `20261012232000_atomic_donation_rewards.sql` | EXACT SQL executed | `20261013061231 atomic_donation_rewards` | Review source prerequisites and current live DDL before applying |
| `20261012232000_atomic_enchantment_application.sql` | Name match; SQL differs | `20261014101520 rockmundo_20261012232000_atomic_enchantment_application` | Review source prerequisites and current live DDL before applying |
| `20261012232100_idempotent_direct_message_fallback.sql` | No recorded SQL/name | — | Superseded by Oct 14 restored idempotent DM RPC; DO NOT run |
| `20261012232200_atomic_underworld_transactions.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261012235000_personal_gear_character_isolation.sql` | Name match; SQL differs | `20261014120855 rockmundo_20261012235000_personal_gear_character_isolation_fixed` | Review source prerequisites and current live DDL before applying |
| `20261012235500_atomic_university_mentor_sessions.sql` | Name match; SQL differs | `20261014101517 rockmundo_20261012235500_atomic_university_mentor_sessions` | Review source prerequisites and current live DDL before applying |
| `20261012235500_song_generation_attempt_prediction_tracking.sql` | No recorded SQL/name | — | Live columns/indexes exist; reconcile without replay |
| `20261012235600_atomic_video_reward_cooldown.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261012235700_atomic_book_reading_start_resume.sql` | Name match; SQL differs | `20261014070630 rockmundo_20261012235700_atomic_book_reading_start_resume` | Review source prerequisites and current live DDL before applying |
| `20261012235800_harden_atomic_book_attendance.sql` | Name match; SQL differs | `20261014070633 rockmundo_20261012235800_harden_atomic_book_attendance` | Review source prerequisites and current live DDL before applying |
| `20261012235900_atomic_legacy_skill_book_completion.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013000000_dedupe_band_member_diaries.sql` | Name match; SQL differs | `20261014101724 rockmundo_20261013000000_dedupe_band_member_diaries` | Review source prerequisites and current live DDL before applying |
| `20261013000100_authoritative_songwriting_instrument_bonus.sql` | No recorded SQL/name | — | Both instrument completion RPCs live |
| `20261013072000_atomic_travel_refunds.sql` | Name match; SQL differs | `20261014101727 rockmundo_20261013072000_atomic_travel_refunds` | Review source prerequisites and current live DDL before applying |
| `20261013072100_festival_edition_sales_scope.sql` | Name match; SQL differs | `20261014064529 rockmundo_20261013072100_festival_edition_sales_scope` | Review source prerequisites and current live DDL before applying |
| `20261013072200_atomic_band_leader_spending.sql` | Name match; SQL differs | `20261014121539 rockmundo_20261013072200_atomic_band_leader_spending_fixed` | Review source prerequisites and current live DDL before applying |
| `20261013073500_atomic_songwriting_pause.sql` | EXACT SQL executed | `20261013064110 atomic_songwriting_pause` | Atomic pause RPC live |
| `20261013074000_single_demo_contract_offer.sql` | EXACT SQL executed | `20261013064112 single_demo_contract_offer` | Review source prerequisites and current live DDL before applying |
| `20261013074100_solo_label_advance_activation.sql` | EXACT SQL executed | `20261013064114 solo_label_advance_activation` | Review source prerequisites and current live DDL before applying |
| `20261013074200_band_sales_cents_carry.sql` | EXACT SQL executed | `20261013064131 band_sales_cents_carry` | Review source prerequisites and current live DDL before applying |
| `20261013074300_stripe_vip_event_order.sql` | Name match; SQL differs | `20261014120705 rockmundo_20261013074300_stripe_vip_event_order` | Review source prerequisites and current live DDL before applying |
| `20261013074400_streaming_delivery_concurrency.sql` | Name match; SQL differs | `20261014064532 rockmundo_20261013074400_streaming_delivery_concurrency` | Review source prerequisites and current live DDL before applying |
| `20261013074500_video_simulation_daily_guard.sql` | Name match; SQL differs | `20261014094116 rockmundo_20261013074500_video_simulation_daily_guard` | Review source prerequisites and current live DDL before applying |
| `20261013074600_streaming_daily_claim.sql` | Name match; SQL differs | `20261014094121 rockmundo_20261013074600_streaming_daily_claim` | Review source prerequisites and current live DDL before applying |
| `20261013074700_chart_band_bonus_once.sql` | Name match; SQL differs | `20261014094125 rockmundo_20261013074700_chart_band_bonus_once` | Review source prerequisites and current live DDL before applying |
| `20261013094500_label_marketing_daily_idempotency.sql` | Name match; SQL differs | `20261014111749 rockmundo_20261013094500_label_marketing_daily_idempotency` | Review source prerequisites and current live DDL before applying |
| `20261013095000_atomic_active_playtime.sql` | Name match; SQL differs | `20261014101944 rockmundo_20261013095000_atomic_active_playtime_signature_fix` | Review source prerequisites and current live DDL before applying |
| `20261013095500_resurrection_eligibility.sql` | Name match; SQL differs | `20261014094326 rockmundo_20261013095500_resurrection_eligibility` | Review source prerequisites and current live DDL before applying |
| `20261013100000_atomic_band_leadership.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013110000_atomic_chart_entries.sql` | Name match; SQL differs | `20261014094113 rockmundo_20261013110000_atomic_chart_entries` | Review source prerequisites and current live DDL before applying |
| `20261013110500_admin_recovery_safety.sql` | Name match; SQL differs | `20261014094540 rockmundo_20261013110500_admin_recovery_safety` | Review source prerequisites and current live DDL before applying |
| `20261013112500_coma_health_freshness.sql` | Name match; SQL differs | `20261014094545 rockmundo_20261013112500_coma_health_freshness` | Review source prerequisites and current live DDL before applying |
| `20261013113000_atomic_daily_stipend.sql` | EXACT SQL executed | `20261015095730 rockmundo_20261013113000_atomic_daily_stipend_safe` | Exact SQL applied via production-safe name |
| `20261013120000_daily_activity_xp_atomic.sql` | Name match; SQL differs | `20261014094329 rockmundo_20261013120000_daily_activity_xp_atomic` | Review source prerequisites and current live DDL before applying |
| `20261013125000_admin_atomic_xp_grants.sql` | No recorded SQL/name | — | RPC already live via another migration; no blind replay |
| `20261013140000_admin_xp_grant_idempotency.sql` | Name match; SQL differs | `20261014094331 rockmundo_20261013140000_admin_xp_grant_idempotency` | Review source prerequisites and current live DDL before applying |
| `20261013140000_atomic_attribute_spend.sql` | Name match; SQL differs | `20261014111538 rockmundo_20261013140000_atomic_attribute_spend` | Name mismatch, later corrected attribute RPC applied Oct 15 |
| `20261013140500_atomic_ap_conversion.sql` | No recorded SQL/name | — | Blocked: xp_ledger absent; must use supported ledger |
| `20261013150000_unlearn_skill_atomic.sql` | Name match; SQL differs | `20261014123728 rockmundo_20261013150000_unlearn_skill_atomic` | Review source prerequisites and current live DDL before applying |
| `20261013150500_action_xp_idempotency.sql` | Name match; SQL differs | `20261014064144 rockmundo_20261013150500_action_xp_idempotency` | Review source prerequisites and current live DDL before applying |
| `20261013155000_atomic_character_recovery.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013161500_atomic_band_leave.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013170000_atomic_retirement_finalization.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013170000_underworld_purchase_arrest.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013180000_release_inventory_reconciliation_queue.sql` | Name match; SQL differs | `20261014064305 rockmundo_20261013180000_release_inventory_reconciliation_queue` | Review source prerequisites and current live DDL before applying |
| `20261013183000_label_release_contract_safe.sql` | Name match; SQL differs | `20261014094334 rockmundo_20261013183000_label_release_contract_safe` | Review source prerequisites and current live DDL before applying |
| `20261013184000_achievement_event_reward_integrity.sql` | No recorded SQL/name | — | Blocked: canonical achievement criteria/reward/event tables absent |
| `20261013184500_profile_scoped_award_stats.sql` | Name match; SQL differs | `20261014094552 rockmundo_20261013184500_profile_scoped_award_stats` | Review source prerequisites and current live DDL before applying |
| `20261013185000_guard_label_contract_termination.sql` | Name match; SQL differs | `20261014094603 rockmundo_20261013185000_guard_label_contract_termination` | Review source prerequisites and current live DDL before applying |
| `20261013190000_one_current_random_event.sql` | Name match; SQL differs | `20261014064147 rockmundo_20261013190000_one_current_random_event` | Review source prerequisites and current live DDL before applying |
| `20261013193000_repair_current_social_invites.sql` | Name match; SQL differs | `20261014102950 rockmundo_20261013193000_repair_current_social_invites` | Review source prerequisites and current live DDL before applying |
| `20261013195000_public_profile_visibility_and_badges.sql` | No recorded SQL/name | — | Blocked: player_profiles, badges, milestones foundations absent |
| `20261013195500_verified_relationship_affinity.sql` | Name match; SQL differs | `20261014101814 rockmundo_20261013195500_verified_relationship_affinity` | Review source prerequisites and current live DDL before applying |
| `20261013201000_private_friend_suggestions_mutual_counts.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261013210000_social_discovery_authoritative_viewer.sql` | No recorded SQL/name | — | Blocked: prior canonical social foundations absent |
| `20261013210100_private_discovery_filters_and_sorting.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20261014113000_durable_deduped_game_notifications.sql` | No recorded SQL/name | — | Pending: index absent and RPC rewrite needs separate review; 0 duplicate event keys |
| `20261015090000_atomic_ai_generation_and_recording_xp.sql` | EXACT SQL executed | `20261015103735 rockmundo_20261015090000_atomic_ai_generation_and_recording_xp` | Exact SQL applied Oct 15; Edge Functions still require rollout |
| `20261031120001_replace_daily_conversion_with_weekly_bonus.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20270602100001_create_education_youtube_tables.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20270615120001_handle_new_user_username_retry.sql` | Renamed; execution unverified | — | Review source prerequisites and current live DDL before applying |
| `20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106170000_repair_band_recruitment_capacity_applications_expiry.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106180000_correct_recruitment_approvals_and_departures.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106181000_character_scoped_notification_archive.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106182000_atomic_chart_entry_notifications.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106190000_harden_band_governance_profile_identity.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106200000_atomic_personal_funded_gig_booking.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106200000_secure_atomic_weekly_band_payroll.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106201000_controlled_random_event_backlog_reconciliation.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |
| `20300106210000_rehearsal_booking_full_intent_idempotency.sql` | No recorded SQL/name | — | Review source prerequisites and current live DDL before applying |

## Unchanged-SQL renames (40)

These do not introduce new SQL, but **38 have no exact SQL execution proof**. Treat renames as Git hygiene, not evidence that live schema is updated.

| Previous filename | Current filename | Execution evidence |
|---|---|---|
| `20260316093000_fix_promotional_campaigns_rls.sql` | `20260316093001_fix_promotional_campaigns_rls.sql` | Identical SQL; live execution not established |
| `20260710120000_beta_admin_support_tools.sql` | `20260710120001_beta_admin_support_tools.sql` | Identical SQL; live execution not established |
| `20260710120000_complete_company_recruitment_lifecycle.sql` | `20260710120002_complete_company_recruitment_lifecycle.sql` | Identical SQL; live execution not established |
| `20260712120000_gig_audience_participation.sql` | `20260712120001_gig_audience_participation.sql` | Identical SQL; live execution not established |
| `20260712120000_gig_live_outcome_breakdown.sql` | `20260712120002_gig_live_outcome_breakdown.sql` | Identical SQL; live execution not established |
| `20260712120000_recording_outcome_breakdown.sql` | `20260712120003_recording_outcome_breakdown.sql` | Identical SQL; live execution not established |
| `20260712120000_songwriting_outcome_calculator.sql` | `20260712120004_songwriting_outcome_calculator.sql` | Identical SQL; live execution not established |
| `20260712120000_tour_operations_multi_gig_management.sql` | `20260712120005_tour_operations_multi_gig_management.sql` | Identical SQL; live execution not established |
| `20260712120000_wellness_accommodation_travel_recovery.sql` | `20260712120006_wellness_accommodation_travel_recovery.sql` | Identical SQL; live execution not established |
| `20260712120000_wellness_professionals.sql` | `20260712120007_wellness_professionals.sql` | Identical SQL; live execution not established |
| `20260712143000_wellness_time_away_longevity.sql` | `20260712143001_wellness_time_away_longevity.sql` | Identical SQL; live execution not established |
| `20260713090000_create_balance_management_registry.sql` | `20260713090001_create_balance_management_registry.sql` | Identical SQL; live execution not established |
| `20260713090000_player_progression_analytics.sql` | `20260713090002_player_progression_analytics.sql` | Identical SQL; live execution not established |
| `20260713120000_progression_achievements_canonical.sql` | `20260713120001_progression_achievements_canonical.sql` | Identical SQL; live execution not established |
| `20260713120000_repair_songwriting_optional_columns.sql` | `20260713120002_repair_songwriting_optional_columns.sql` | Identical SQL; live execution not established |
| `20260713130000_fix_skill_xp_spending.sql` | `20260713130001_fix_skill_xp_spending.sql` | Identical SQL; live execution not established |
| `20260713130000_player_discovery_search_matchmaking.sql` | `20260713130002_player_discovery_search_matchmaking.sql` | Identical SQL; live execution not established |
| `20260713193000_private_messaging_conversations.sql` | `20260713193001_private_messaging_conversations.sql` | Identical SQL; live execution not established |
| `20260717120000_finance_phase2_player_band_management.sql` | `20260717120001_finance_phase2_player_band_management.sql` | Identical SQL; live execution not established |
| `20260717153000_harden_festival_creation_phase1_forward.sql` | `20260717153001_harden_festival_creation_phase1_forward.sql` | Identical SQL; live execution not established |
| `20260720120000_repair_london_fixture_operations_projection.sql` | `20260720120001_repair_london_fixture_operations_projection.sql` | Identical SQL; live execution not established |
| `20260721120000_repair_banking_dashboard_rpc.sql` | `20260721120001_repair_banking_dashboard_rpc.sql` | Identical SQL; live execution not established |
| `20260728120000_fix_gig_booking_band_fame.sql` | `20260728120001_fix_gig_booking_band_fame.sql` | Identical SQL; live execution not established |
| `20260728120000_reconcile_player_cash_finance.sql` | `20260728120002_reconcile_player_cash_finance.sql` | Identical SQL; live execution not established |
| `20260728130000_replace_legacy_gig_travel_trigger.sql` | `20260728130001_replace_legacy_gig_travel_trigger.sql` | Identical SQL; live execution not established |
| `20260728140000_fix_podcast_submission_membership_check.sql` | `20260728140001_fix_podcast_submission_membership_check.sql` | Identical SQL; live execution not established |
| `20260728150000_submit_podcast_appearance_rpc.sql` | `20260728150001_submit_podcast_appearance_rpc.sql` | Identical SQL; live execution not established |
| `20260825101500_support_band_tour_matching.sql` | `20260825101501_support_band_tour_matching.sql` | Identical SQL; live execution not established |
| `20260825145500_song_live_and_cover_stats.sql` | `20260825145501_song_live_and_cover_stats.sql` | Identical SQL; live execution not established |
| `20260906193000_record_stock_label_marketing.sql` | `20260906193001_record_stock_label_marketing.sql` | Identical SQL; live execution not established |
| `20260907070000_major_event_invitation_application_flow.sql` | `20260907070001_major_event_invitation_application_flow.sql` | Identical SQL; live execution not established |
| `20260910170500_band_clothing_performance_bonus.sql` | `20260910170501_band_clothing_performance_bonus.sql` | Identical SQL; live execution not established |
| `20260921100000_add_show_type_to_gigs_and_tour_venues.sql` | `20260921100001_add_show_type_to_gigs_and_tour_venues.sql` | Identical SQL; live execution not established |
| `20260922100000_update_player_skills_baseline.sql` | `20260922100001_update_player_skills_baseline.sql` | Identical SQL; live execution not established |
| `20260922110000_rebalance_label_marketing_reach.sql` | `20260922110001_rebalance_label_marketing_reach.sql` | Exact SQL executed |
| `20260922110000_split_player_skills_attributes.sql` | `20260922110002_split_player_skills_attributes.sql` | Identical SQL; live execution not established |
| `20261007154500_referral_campaign_attribution.sql` | `20261007154501_referral_campaign_attribution.sql` | Exact SQL executed |
| `20261031120000_replace_daily_conversion_with_weekly_bonus.sql` | `20261031120001_replace_daily_conversion_with_weekly_bonus.sql` | Identical SQL; live execution not established |
| `20270602100000_create_education_youtube_tables.sql` | `20270602100001_create_education_youtube_tables.sql` | Identical SQL; live execution not established |
| `20270615120000_handle_new_user_username_retry.sql` | `20270615120001_handle_new_user_username_retry.sql` | Identical SQL; live execution not established |

## Modified existing files (5)

Never replace an already-deployed function or migration directly based on these changed bodies without reconciling the stored SQL.

| File | Baseline Git blob | Current Git blob | Current body |
|---|---|---|---|
| `20260308145318_c0dbd6df-ba8d-4a77-9cd3-45a3f5dcb113.sql` | `70cf5e9582046b29ed9137d301a4a2b466e853ae` | `0384d46328351936ccd11c87d7a92f022e464f53` | No recorded SQL/name |
| `20260315090000_add_character_slots.sql` | `0bb5847b4922dc37702d1253cfa2f59ec9621d55` | `292bdd3abad9560aa478348cc1a6dad05ae2d13b` | No recorded SQL/name |
| `20260317093000_expand_award_shows_invites_and_script.sql` | `9a84b4e0aa934de17808b123199fac9b59b2a826` | `b9fe442e2dcb82e21a7e6c936b569d4d0d87a562` | No recorded SQL/name |
| `20260318054915_7461c75c-09c0-4a52-9464-9d89a1832bb5.sql` | `5faffda7191a84647646e0b01bf11ea9984ee394` | `5fa6dd2c323642adf709b08044c16250389f9665` | No recorded SQL/name |
| `20261008110000_twaater_referral_publication_audit.sql` | `e4ba064aa71b76729e392437a11be962b892e078` | `9f0edf3dbfca1b1efa6472cb7d9f798892a854da` | EXACT SQL executed |

## Other removed SQL paths (2)

- `20260923110000_normalize_skills_down.sql` (removed from main; rollback/down scripts must never be replayed)
- `20261025100000_add_extended_skill_definitions_down.sql` (removed from main; rollback/down scripts must never be replayed)

## Deployment gate

Before applying any pending row: confirm PITR/backup and restore rehearsal, obtain or create a sanitized production-schema staging environment, compare complete SQL and live object definitions, test rollback and concurrency, verify ownership/RLS and SECURITY DEFINER grants, deploy one compatibility repair at a time with explicit recorded migration history, inspect game-facing callers and Edge Function compatibility, then verify live balances, ledgers and cron jobs. The 180-path manifest above is an audit, **not** an approved migration batch.
