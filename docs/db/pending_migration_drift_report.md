# Pending Migration Drift Report

Generated against live schema on 2026-07-16. Total pending migrations: **127**.

## Summary

- Pending migration files (after `20260716212957`): **127**
- Tables referenced by pending files: **213**
- Tables that DO NOT exist in the live DB (safe new-tables): **102**
- Migrations that CREATE a table already existing in live DB (**high-risk conflict**): **50**
- Migrations that only ADD columns to existing live tables (**check per-column**): **29**
- Migrations that only CREATE new tables (**safe if ordered**): **12**
- Migrations with policies/inserts/functions only (**other**): **34**

## Known drift patterns

- **`user_id` vs `profile_id`**: `busking_sessions` (live uses `profile_id`), `player_ailments` (both), `experience_ledger` (both), `activity_feed` (both). Pending files that reference `user_id` on `busking_sessions` will fail.
- **`cities` expansion (20260917093000)**: Live already has `latitude,longitude,region,timezone,is_coastal,has_train_network,climate_type`. Re-adding these will fail unless the migration uses `IF NOT EXISTS`.
- **Festival Edition cluster (20291200-20291216)**: Nearly every core edition table (`festival_editions`, `festival_edition_lifecycle_events`, `festival_legacy_mappings`, `festival_edition_creation_requests`, `festival_edition_transition_requests`, `festival_operation_migration_issues`, `festival_system_acts`, `festival_edition_management_roles`, `festival_staff_candidates_persistent`, `festival_edition_insurance_quotes`, `festival_edition_budget_changes`, `festival_edition_poster_versions`) is MISSING from live — the cluster is genuinely undeployed and safe to apply in filename order.
- **Progression/attributes cluster**: `attribute_catalog`, `attribute_definitions`, `attribute_spend`, `player_attribute_snapshots`, `skill_progression_events`, `skill_attribute_links`, `xp_ledger` are all missing — safe to add. But `player_attributes` and `player_skills` already exist with different columns — any migration that redefines them is a conflict.
- **Loadouts / gear catalog** (`loadouts`, `loadout_items`, `loadout_slot_definitions`, `gear_categories`, `gear_items`, `personal_gear_catalog`, `player_gear_slots`): none exist in live. Safe to deploy.
- **Casting / social safety** (`casting_*` already exist; `social_safety_actions`, `social_safety_reports` do not). Mixed — inspect each file.

## Conflicting CREATE TABLE (table already exists) — 50

### `20260917093000_expand_cities_with_travel_metadata.sql` (11329B)
- **CREATE (conflict):** cities
- ALTER `cities` ADD: description

### `20260920120000_create_busking_tables.sql` (6855B)
- **CREATE (conflict):** busking_sessions
- CREATE (new): busking_locations, busking_modifiers

### `20260921090000_create_production_sessions_tables.sql` (5175B)
- **CREATE (conflict):** production_tracks, recording_sessions

### `20260922110000_create_attribute_tables.sql` (4843B)
- **CREATE (conflict):** profile_attributes
- CREATE (new): attribute_definitions

### `20260922110000_split_player_skills_attributes.sql` (4286B)
- **CREATE (conflict):** player_attributes

### `20260922120000_add_player_attributes_and_update_skills.sql` (8698B)
- **CREATE (conflict):** player_attributes

### `20260923100000_create_player_attribute_catalog.sql` (13100B)
- **CREATE (conflict):** player_attributes
- CREATE (new): attribute_catalog

### `20260923110000_normalize_skills.sql` (13411B)
- **CREATE (conflict):** profile_skill_progress, profile_skill_unlocks, skill_definitions, skill_relationships

### `20261022103000_add_city_night_clubs.sql` (1658B)
- **CREATE (conflict):** city_night_clubs

### `20261030130000_create_xp_tables.sql` (7622B)
- **CREATE (conflict):** player_attributes, player_daily_cats, player_weekly_activity, player_xp_wallet
- CREATE (new): attribute_spend, xp_ledger
- ALTER `player_attributes` ADD: attribute_points

### `20261031120000_create_profile_progression_tables.sql` (21199B)
- **CREATE (conflict):** profile_action_xp_events, profile_attribute_transactions, profile_respec_events, profile_weekly_bonus_claims

### `20261031120000_replace_daily_conversion_with_weekly_bonus.sql` (6780B)
- **CREATE (conflict):** experience_ledger
- ALTER `profiles` ADD: last_weekly_bonus_at

### `20261101100000_create_friendships_table.sql` (4181B)
- **CREATE (conflict):** friendships

### `20261108090000_create_sponsorship_offers.sql` (3601B)
- **CREATE (conflict):** sponsorship_brands, sponsorship_entities, sponsorship_notifications, sponsorship_offers

### `20261202090000_create_universities_table.sql` (2137B)
- **CREATE (conflict):** universities

### `20261205100000_create_skill_books_tables.sql` (5354B)
- **CREATE (conflict):** player_skill_books, skill_books

### `20270101090000_create_public_universities.sql` (2095B)
- **CREATE (conflict):** universities

### `20270102090000_create_skill_books_tables.sql` (2830B)
- **CREATE (conflict):** player_skill_books, skill_books

### `20270402090000_create_public_universities_table.sql` (2076B)
- **CREATE (conflict):** universities

### `20270418100000_add_venue_support_structures.sql` (5208B)
- **CREATE (conflict):** venue_bookings, venue_relationships
- ALTER `venues` ADD: city

### `20270420120000_create_festival_tables.sql` (5812B)
- **CREATE (conflict):** festival_lineups, festivals

### `20270425130000_add_universities_and_skill_books_updates.sql` (5074B)
- **CREATE (conflict):** skill_books, universities
- ALTER `profiles` ADD: current_city_id
- ALTER `skill_books` ADD: skill_slug

### `20270601120000_add_daily_xp_allocation.sql` (8856B)
- **CREATE (conflict):** profile_daily_xp_grants

### `20270602100000_create_education_youtube_tables.sql` (3928B)
- **CREATE (conflict):** education_youtube_resources
- CREATE (new): education_youtube_lessons

### `20270602130000_create_education_mentors_table.sql` (1254B)
- **CREATE (conflict):** education_mentors

### `20270606100000_add_profile_activity_statuses.sql` (2927B)
- **CREATE (conflict):** profile_activity_statuses
- ALTER `activity_feed` ADD: status

### `20270607100000_create_songwriting_tables.sql` (4314B)
- **CREATE (conflict):** songwriting_projects, songwriting_sessions

### `20270617103000_create_world_environment_tables.sql` (7810B)
- **CREATE (conflict):** random_events, studios, weather, world_events
- CREATE (new): city_metadata

### `20270630100000_create_studio_infrastructure.sql` (11429B)
- **CREATE (conflict):** studio_booking_artists, studio_booking_slots, studio_booking_songs, studio_bookings, studios

### `20270630153000_expand_songwriting_and_activity_schema.sql` (6600B)
- **CREATE (conflict):** profile_activity_statuses
- ALTER `activity_feed` ADD: status
- ALTER `songwriting_projects` ADD: theme_id
- ALTER `songwriting_sessions` ADD: session_start
- ALTER `songs` ADD: theme_id

### `20270631100000_enhance_songwriting_dimensions.sql` (18942B)
- **CREATE (conflict):** song_genre_catalog, song_purposes, song_writing_modes, songwriting_project_collaborators, songwriting_session_contributors
- ALTER `songwriting_projects` ADD: genre_id
- ALTER `songs` ADD: genre_id

### `20270631123000_create_admin_cron_monitor_tables.sql` (8300B)
- **CREATE (conflict):** admin_cron_job_runs
- CREATE (new): admin_cron_jobs

### `20270712120000_create_canonical_skill_catalogue.sql` (12312B)
- **CREATE (conflict):** skill_prerequisites, skill_role_links, skill_system_links, skill_unlock_routes
- CREATE (new): skill_attribute_links
- ALTER `skill_definitions` ADD: category

### `20270712150000_progression_balance_v2.sql` (1938B)
- **CREATE (conflict):** progression_balance_versions

### `20270712170000_add_skill_maintenance.sql` (3757B)
- **CREATE (conflict):** player_skill_sharpness
- CREATE (new): skill_maintenance_events
- ALTER `skill_definitions` ADD: supports_maintenance

### `20271115090000_create_songwriting_draft_tables.sql` (1135B)
- **CREATE (conflict):** songwriting_draft_revisions, songwriting_drafts

### `20290602120001_create_personal_loadouts.sql` (15776B)
- **CREATE (conflict):** personal_loadout_items, personal_loadout_pedal_slots, personal_loadouts
- CREATE (new): gear_items

### `20290602130000_extend_personal_loadouts_with_slots.sql` (4982B)
- **CREATE (conflict):** personal_loadout_slots

### `20290603100000_create_music_video_release_tables.sql` (2977B)
- **CREATE (conflict):** music_video_configs, music_video_metrics

### `20290701090000_enhance_equipment_purchase_and_gear_pool.sql` (13639B)
- **CREATE (conflict):** player_equipment_ownership_history, player_gear_pool
- CREATE (new): gear_slot_catalog
- ALTER `player_equipment` ADD: available_for_loadout

### `20290702100000_create_story_narrative_tables.sql` (2620B)
- **CREATE (conflict):** story_choices, story_states

### `20291012090000_create_casting_calls_workflow.sql` (3762B)
- **CREATE (conflict):** casting_call_roles, casting_calls, casting_reviews, casting_submissions

### `20291115090000_create_eurovision_tables.sql` (1667B)
- **CREATE (conflict):** eurovision_entries, eurovision_votes
- CREATE (new): eurovision_winners, eurovision_years

### `20291201090000_create_sponsorship_tables.sql` (6141B)
- **CREATE (conflict):** sponsorship_contracts, sponsorship_history, sponsorship_offers
- CREATE (new): brands

### `20291203090000_player_social_safety.sql` (22263B)
- **CREATE (conflict):** player_blocks, player_report_evidence, player_reports

### `20291206090000_festival_booking_contracts.sql` (40801B)
- **CREATE (conflict):** festival_contract_setlist_items, festival_contract_setlists, festival_contract_signatures, festival_offer_revisions
- CREATE (new): festival_application_events, festival_applications, festival_contract_events, festival_contract_offers, festival_contracts
- ALTER `festival_stage_slots` ADD: canonical_contract_id

### `20291207090000_harden_festival_booking_contracts.sql` (50571B)
- **CREATE (conflict):** festival_contract_versions, festival_stage_slot_reservations
- CREATE (new): festival_booking_requests
- ALTER `festival_contract_setlists` ADD: supersedes_setlist_id, is_current, content_hash
- ALTER (missing table) `festival_contract_offers` ADD: current_revision_id, accepted_revision_id, current_terms_hash
- ALTER (missing table) `festival_contracts` ADD: current_version_id, settlement_required, cancelled_by_side, cancelled_by_profile_id

### `20291209090000_festival_performance_sessions.sql` (37472B)
- **CREATE (conflict):** festival_performance_attendance, festival_performance_session_events, festival_session_crew, festival_session_equipment
- CREATE (new): festival_performance_incidents, festival_performance_sessions

### `20291210090000_festival_audience_and_outcomes.sql` (44555B)
- **CREATE (conflict):** festival_fan_conversion_outcomes, festival_media_outcomes, festival_outcome_publications, festival_performance_audience_snapshots, festival_performance_effects, festival_performance_highlights, festival_song_performance_outcomes, festival_sponsor_outcomes, festival_stage_crowd_snapshots
- CREATE (new): festival_audience_cohorts, festival_audience_generations, festival_audience_simulation_configs, festival_performance_outcomes

### `20291213090000_festival_effects_and_settlement.sql` (30013B)
- **CREATE (conflict):** festival_contract_settlement_instructions, festival_edition_financial_results, festival_edition_settlements, festival_effect_applications, festival_fan_conversion_applications, festival_settlement_effect_configs, festival_settlement_transactions, streaming_uplift_campaigns
- CREATE (new): festival_settlement_events

## ADD COLUMN on existing tables (check each column) — 29

### `20260916000001_add_audio_layers_to_songs.sql` (296B)
- ALTER `songs` ADD: audio_layers

### `20260916060000_add_profile_location_health.sql` (5627B)
- ALTER `profiles` ADD: current_city_id

### `20260921100000_add_show_type_to_gigs_and_tour_venues.sql` (616B)
- ALTER `gigs` ADD: show_type
- ALTER `tour_venues` ADD: show_type

### `20260921120000_add_logo_url_to_bands.sql` (77B)
- ALTER `bands` ADD: logo_url

### `20260921130000_add_busking_value_to_cities.sql` (472B)
- ALTER `cities` ADD: busking_value

### `20260923113000_add_performance_social_attributes.sql` (1305B)
- ALTER `player_attributes` ADD: stage_presence

### `20261001090000_add_profile_character_slots.sql` (6699B)
- ALTER `profiles` ADD: slot_number

### `20261001120000_refresh_profiles_age_schema.sql` (724B)
- ALTER `profiles` ADD: age

### `20261002100000_add_experience_point_conversion.sql` (5613B)
- ALTER `profiles` ADD: skill_points_available

### `20261030120000_add_city_reference_to_venues.sql` (570B)
- ALTER `venues` ADD: city_id

### `20261105120000_replace_venue_city_id_with_city.sql` (1668B)
- ALTER `venues` ADD: city

### `20270415100000_add_city_of_birth_to_profiles.sql` (549B)
- ALTER `profiles` ADD: city_of_birth

### `20270415110000_refresh_profiles_gender_column.sql` (651B)
- ALTER `profiles` ADD: gender

### `20270425140000_refresh_profile_gender_and_notify.sql` (209B)
- ALTER `profiles` ADD: gender

### `20270426100000_extend_profiles_demographics.sql` (2260B)
- ALTER `profiles` ADD: gender

### `20270426150000_refresh_profiles_columns_and_schema_cache.sql` (705B)
- ALTER `profiles` ADD: gender

### `20270430100000_add_profile_city_gender_age.sql` (1768B)
- ALTER `profiles` ADD: gender

### `20270430110000_add_current_city_id_to_profiles.sql` (285B)
- ALTER `profiles` ADD: current_city_id

### `20270430120000_ensure_current_city_columns.sql` (1004B)
- ALTER `profiles` ADD: current_city, current_city_id

### `20270431140000_refresh_profiles_age_schema_cache.sql` (765B)
- ALTER `profiles` ADD: age

### `20270602120000_add_city_profile_fields.sql` (987B)
- ALTER `cities` ADD: profile_description

### `20270610120000_align_songwriting_schema.sql` (2781B)
- ALTER `songwriting_projects` ADD: lyrics
- ALTER `songwriting_sessions` ADD: started_at

### `20270620140000_add_unlocked_flag_to_cities.sql` (303B)
- ALTER `cities` ADD: unlocked

### `20270621100000_update_profile_daily_xp_grants.sql` (3148B)
- ALTER `profile_daily_xp_grants` ADD: metadata, claimed_at

### `20270630170000_refine_songwriting_schema.sql` (6587B)
- ALTER `songwriting_projects` ADD: estimated_completion_sessions
- ALTER `songs` ADD: estimated_completion_sessions

### `20290601120000_add_avatar_and_location_to_profiles.sql` (280B)
- ALTER `profiles` ADD: avatar_url

### `20290602110000_ensure_auto_clock_in_column.sql` (314B)
- ALTER `player_employment` ADD: auto_clock_in

### `20290620120000_enhance_music_video_configs.sql` (1339B)
- ALTER `music_video_configs` ADD: status
- ALTER `music_video_metrics` ADD: platform

### `20290702010000_extend_label_financials.sql` (977B)
- ALTER `labels` ADD: operating_budget
- ALTER `artist_label_contracts` ADD: lifetime_gross_revenue
- ALTER `label_releases` ADD: streaming_revenue

## Clean CREATE TABLE (new tables only) — 12

### `20261101090000_ensure_schedule_events_schema.sql` (5540B)
- CREATE (new): schedule_events
- ALTER (missing table) `schedule_events` ADD: reminder_minutes

### `20261111090000_create_brand_sponsorships.sql` (3437B)
- CREATE (new): brand_contract_history, brand_contracts, brand_offers, brand_partners, brand_payouts

### `20261201090000_create_skills_table.sql` (747B)
- CREATE (new): skills

### `20270602100000_create_education_band_sessions.sql` (1833B)
- CREATE (new): education_band_sessions

### `20290702010000_create_community_feed_tables.sql` (2521B)
- CREATE (new): community_post_reactions, community_posts

### `20290702095000_create_community_charity_tables.sql` (2796B)
- CREATE (new): community_charity_campaigns, community_charity_donations, community_charity_impact_metrics

### `20290702120000_create_band_membership_management.sql` (3133B)
- CREATE (new): band_membership_roles, band_membership_status_history

### `20290705090000_create_side_hustle_progress_tables.sql` (2870B)
- CREATE (new): side_hustle_minigame_attempts, side_hustle_progress

### `20290711030000_rehearsal_attendance_gig_lineups.sql` (12066B)
- CREATE (new): band_rehearsal_participants, gig_performers

### `20291202090000_beta_rls_hardening.sql` (5933B)
- CREATE (new): admin_action_audit

### `20291204090000_create_festival_editions.sql` (23471B)
- CREATE (new): festival_edition_lifecycle_events, festival_editions, festival_legacy_mappings

### `20291205090000_harden_festival_editions.sql` (18619B)
- CREATE (new): festival_edition_creation_requests, festival_edition_transition_requests

## Adds columns to tables that also need to be created — 2

### `20260921100000_add_sales_metrics_to_global_charts.sql` (2287B)
- ALTER (missing table) `global_charts` ADD: physical_sales

### `20260922100000_add_duration_and_energy_to_schedule_events.sql` (685B)
- ALTER (missing table) `schedule_events` ADD: duration_minutes

## Other (policies / functions / inserts only) — 34

### `20260922100000_update_player_skills_baseline.sql` (5037B)

### `20260923110000_normalize_skills_down.sql` (238B)

### `20260924100000_add_portsmouth_city_and_defaults.sql` (10209B)

### `20261001130000_switch_default_city_to_london.sql` (12022B)

### `20261005120000_expand_player_skills_scale.sql` (1465B)

### `20261020100000_zero_skill_attribute_defaults.sql` (9545B)

### `20261025100000_add_extended_skill_definitions.sql` (9271B)

### `20261025100000_add_extended_skill_definitions_down.sql` (2107B)

### `20261031123000_create_progression_functions.sql` (25532B)

### `20261105090000_create_radio_play_metrics_functions.sql` (1317B)

### `20261201000000_add_check_radio_submission_week.sql` (1079B)

### `20270415120000_update_player_attribute_defaults.sql` (8257B)

### `20270431150000_reset_profile_data.sql` (1052B)

### `20270431160000_enforce_player_skills_minimum.sql` (9480B)

### `20270431163000_daily_login_attribute_bonus.sql` (2192B)

### `20270607120000_expand_song_quality_scale.sql` (1859B)

### `20270612120000_handle_new_user_city_fallback.sql` (7482B)

### `20270612150000_update_ensure_player_attributes.sql` (2662B)

### `20270615120000_expand_youtube_skills.sql` (917B)

### `20270615120000_handle_new_user_username_retry.sql` (4906B)

### `20270620120000_grant_songwriting_privileges.sql` (172B)

### `20270620130000_grant_public_profiles_select_to_anon.sql` (54B)

### `20270624110000_update_cities_policies.sql` (577B)

### `20270702100000_fix_admin_cron_monitor_access.sql` (1323B)

### `20290602130000_expand_equipment_categories_and_currency.sql` (5746B)
- CREATE (new): gear_categories
- ALTER `equipment_items` ADD: gear_category_id

### `20290602130000_seed_more_achievements_and_unlock_xp.sql` (4074B)

### `20290603110000_create_process_radio_submission_function.sql` (6256B)

### `20290711020000_contribution_source_adapters.sql` (5501B)

### `20291208090000_complete_festival_booking_workspaces.sql` (13228B)

### `20291211090000_festival_admin_management.sql` (22356B)
- CREATE (new): festival_admin_audit_events, festival_edition_management_roles
- ALTER `festival_stages` ADD: edition_id
- ALTER `festival_stage_slots` ADD: edition_id, public_status, soundcheck_at, changeover_minutes, headline_eligible
- ALTER `festival_staff` ADD: edition_id
- ALTER `festival_permits` ADD: edition_id
- ALTER `festival_insurance_policies` ADD: edition_id
- ALTER `festival_expense_ledger` ADD: edition_id

### `20291212090000_complete_festival_edition_operations.sql` (82496B)
- CREATE (new): festival_edition_budget_changes, festival_edition_insurance_quotes, festival_edition_poster_versions, festival_operation_migration_issues, festival_staff_candidates_persistent, festival_system_acts
- ALTER `festival_stages` ADD: archived_at, archived_reason, stage_type, stage_size, sound_capability, lighting_capability, backstage_capability, weather_protection, default_changeover_minutes, curfew_time, technical_metadata, public_metadata, idempotency_key
- ALTER `festival_stage_slots` ADD: archived_at, archived_reason, slot_template, reservation_metadata, idempotency_key
- ALTER `festival_staff` ADD: candidate_id, assignment_scope, shift_start_at, shift_end_at, status, idempotency_key
- ALTER `festival_permits` ADD: requirement_code, applicant_profile_id, reason, idempotency_key
- ALTER `festival_insurance_policies` ADD: quote_id, policy_status, idempotency_key
- ALTER `festival_expense_ledger` ADD: currency_code, status, source_type, source_id, due_at, idempotency_key

### `20291213080000_stabilise_festival_domain.sql` (4977B)

### `20291214080000_repair_and_expose_festival_features.sql` (10936B)

### `20291216080000_repair_festival_owner_bootstrap.sql` (8773B)


## Guardrail analysis (CREATE TABLE IF NOT EXISTS)

Of the 65 pending migrations that CREATE tables, **59 use `IF NOT EXISTS`** — safe to replay against the live DB. Only **6 use unguarded `CREATE TABLE`** and MUST be inspected before deployment:

- `20260923110000_normalize_skills.sql` — unguarded creates: skill_definitions, skill_relationships, profile_skill_progress, profile_skill_unlocks
- `20261101100000_create_friendships_table.sql` — unguarded creates: friendships
- `20290603100000_create_music_video_release_tables.sql` — unguarded creates: music_video_configs, music_video_metrics
- `20290702100000_create_story_narrative_tables.sql` — unguarded creates: story_states, story_choices
- `20290705090000_create_side_hustle_progress_tables.sql` — unguarded creates: side_hustle_progress, side_hustle_minigame_attempts
- `20291206090000_festival_booking_contracts.sql` — unguarded creates: festival_applications, festival_contract_offers, festival_offer_revisions, festival_contracts, festival_contract_signatures, festival_contract_setlists, festival_contract_setlist_items, festival_application_events, festival_contract_events

## Recommended deployment order

1. **Phase A — Safe new features** (12 clean-new-table migrations + 34 policy/function-only): deploy in filename order.
2. **Phase B — Festival Edition cluster** (Dec 2029, ~16 files, mostly `IF NOT EXISTS`): deploy in filename order. This unblocks the admin console errors reported earlier.
3. **Phase C — Column additions** (29 files touching existing tables): for each, run `information_schema.columns` check first; skip columns that already exist. Watch for `user_id`/`profile_id` divergence on `busking_sessions`, `activity_feed`, `player_ailments`, `experience_ledger`.
4. **Phase D — 6 unguarded CREATE TABLE files**: rewrite each to `CREATE TABLE IF NOT EXISTS` (or gate behind an existence check) before deploying.
5. **Phase E — RLS/policy-only migrations**: replay last so they attach to whatever schema Phases A-D produced.
