# Correcting the historical 2027 migration prefixes (2026-10-18)

All 48 SQL files previously named `2027...` were first committed in 2025 or 2026. New timestamps use the UTC timestamp of their **first Git addition commit**, not modification time. The SQL Git blob SHA is preserved for each rename. Neither the original nor new version occurs in the linked remote ledger (verified 2026-10-18); this alone does not prove the SQL has not already been applied manually.

| Previous filename | New filename |
|---|---|
| `20270101090000_create_public_universities.sql` | `20250919082339_create_public_universities.sql` |
| `20270102090000_create_skill_books_tables.sql` | `20250919100056_create_skill_books_tables.sql` |
| `20270402090000_create_public_universities_table.sql` | `20250919100102_create_public_universities_table.sql` |
| `20270415100000_add_city_of_birth_to_profiles.sql` | `20250919120754_add_city_of_birth_to_profiles.sql` |
| `20270415110000_refresh_profiles_gender_column.sql` | `20250919124259_refresh_profiles_gender_column.sql` |
| `20270415120000_update_player_attribute_defaults.sql` | `20250917154859_update_player_attribute_defaults.sql` |
| `20270418100000_add_venue_support_structures.sql` | `20250919133739_add_venue_support_structures.sql` |
| `20270420120000_create_festival_tables.sql` | `20250919174355_create_festival_tables.sql` |
| `20270425130000_add_universities_and_skill_books_updates.sql` | `20250920140906_add_universities_and_skill_books_updates.sql` |
| `20270425140000_refresh_profile_gender_and_notify.sql` | `20250920142710_refresh_profile_gender_and_notify.sql` |
| `20270426100000_extend_profiles_demographics.sql` | `20250920142451_extend_profiles_demographics.sql` |
| `20270426150000_refresh_profiles_columns_and_schema_cache.sql` | `20250919124300_refresh_profiles_columns_and_schema_cache.sql` |
| `20270430100000_add_profile_city_gender_age.sql` | `20250920155525_add_profile_city_gender_age.sql` |
| `20270430110000_add_current_city_id_to_profiles.sql` | `20250920184927_add_current_city_id_to_profiles.sql` |
| `20270430120000_ensure_current_city_columns.sql` | `20250920194935_ensure_current_city_columns.sql` |
| `20270431140000_refresh_profiles_age_schema_cache.sql` | `20250918093028_refresh_profiles_age_schema_cache.sql` |
| `20270431150000_reset_profile_data.sql` | `20250920191743_reset_profile_data.sql` |
| `20270431160000_enforce_player_skills_minimum.sql` | `20250917154900_enforce_player_skills_minimum.sql` |
| `20270431163000_daily_login_attribute_bonus.sql` | `20250920204838_daily_login_attribute_bonus.sql` |
| `20270601120000_add_daily_xp_allocation.sql` | `20250921111329_add_daily_xp_allocation.sql` |
| `20270602100000_create_education_band_sessions.sql` | `20250921113739_create_education_band_sessions.sql` |
| `20270602100001_create_education_youtube_tables.sql` | `20250921115854_create_education_youtube_tables.sql` |
| `20270602120000_add_city_profile_fields.sql` | `20250921112632_add_city_profile_fields.sql` |
| `20270602130000_create_education_mentors_table.sql` | `20250921113440_create_education_mentors_table.sql` |
| `20270606100000_add_profile_activity_statuses.sql` | `20250923210318_add_profile_activity_statuses.sql` |
| `20270607100000_create_songwriting_tables.sql` | `20250923223323_create_songwriting_tables.sql` |
| `20270607120000_expand_song_quality_scale.sql` | `20250923224216_expand_song_quality_scale.sql` |
| `20270610120000_align_songwriting_schema.sql` | `20250929091549_align_songwriting_schema.sql` |
| `20270612120000_handle_new_user_city_fallback.sql` | `20250917154901_handle_new_user_city_fallback.sql` |
| `20270612150000_update_ensure_player_attributes.sql` | `20250925205416_update_ensure_player_attributes.sql` |
| `20270615120000_expand_youtube_skills.sql` | `20251007143152_expand_youtube_skills.sql` |
| `20270615120001_handle_new_user_username_retry.sql` | `20250925211737_handle_new_user_username_retry.sql` |
| `20270617103000_create_world_environment_tables.sql` | `20250925211726_create_world_environment_tables.sql` |
| `20270620120000_grant_songwriting_privileges.sql` | `20250925220021_grant_songwriting_privileges.sql` |
| `20270620130000_grant_public_profiles_select_to_anon.sql` | `20250925220758_grant_public_profiles_select_to_anon.sql` |
| `20270620140000_add_unlocked_flag_to_cities.sql` | `20250926075413_add_unlocked_flag_to_cities.sql` |
| `20270621100000_update_profile_daily_xp_grants.sql` | `20250926105313_update_profile_daily_xp_grants.sql` |
| `20270624110000_update_cities_policies.sql` | `20250926141346_update_cities_policies.sql` |
| `20270630100000_create_studio_infrastructure.sql` | `20250926102512_create_studio_infrastructure.sql` |
| `20270630153000_expand_songwriting_and_activity_schema.sql` | `20250929101627_expand_songwriting_and_activity_schema.sql` |
| `20270630170000_refine_songwriting_schema.sql` | `20250929104000_refine_songwriting_schema.sql` |
| `20270631100000_enhance_songwriting_dimensions.sql` | `20251002212900_enhance_songwriting_dimensions.sql` |
| `20270631123000_create_admin_cron_monitor_tables.sql` | `20251108083155_create_admin_cron_monitor_tables.sql` |
| `20270702100000_fix_admin_cron_monitor_access.sql` | `20251108084813_fix_admin_cron_monitor_access.sql` |
| `20270712120000_create_canonical_skill_catalogue.sql` | `20260712193517_create_canonical_skill_catalogue.sql` |
| `20270712150000_progression_balance_v2.sql` | `20260712195120_progression_balance_v2.sql` |
| `20270712170000_add_skill_maintenance.sql` | `20260713052009_add_skill_maintenance.sql` |
| `20271115090000_create_songwriting_draft_tables.sql` | `20251114212855_create_songwriting_draft_tables.sql` |

**Release hold:** The production ledger diverges substantially from Git. Do not replay these files or merge before proving their actual live schema effects and validating a fresh staging reset; some of the old dates were intentionally sorted after other migrations and changing the timestamp also changes deployment order. Zero live database writes in this PR.

> Original Git history can reveal prior filenames/re-additions; these nine refinements use the earliest first-add commit found with `git log --follow`. When multiple files share an introduction second, distinct seconds on that same UTC day preserve unique version IDs.
