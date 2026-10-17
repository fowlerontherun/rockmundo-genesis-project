# Migration classification against live schema — 2026-10-17

Generated read-only by `scripts/supabase/classify-migrations-against-live.mjs` from a structure-only snapshot (table, view, function, policy and trigger names). No data or schema was changed.

| Status | Scripts | Meaning |
|---|---|---|
| applied | 948 | Every object the script creates exists live (often under a different history version) |
| partial | 233 | Some objects exist; later scripts often replaced or renamed the rest. Review before acting |
| missing | 196 | None of the objects the script creates exist live |
| unverifiable | 562 | Only alters columns, grants, data or function bodies; needs column/signature checks |

Only 260 of 1,918 repository versions are recorded under the same version in live history, so history must not be used to mark scripts applied. Do not insert fake history rows; record decisions in a reconciliation registry instead.

Next decisions (Phase 4): for each missing/partial cluster, deploy via a new forward-only migration, merge into the live design, or retire.

## Missing (196)

| Script | In history | Present | Example missing objects |
|---|---|---|---|
| 086_band_member_locks.sql | no | 0/1 | tables:band_member_locks |
| 20250916081700_seed_more_achievements_and_unlock_xp.sql | no | 0/2 | functions:award_achievement_unlock_xp, triggers:trg_award_achievement_unlock_xp |
| 20250916085440_446206dd-4681-4653-9198-bcc512ebdd45.sql | no | 0/1 | triggers:on_auth_user_created |
| 20250916103000_create_global_charts_tables.sql | no | 0/4 | tables:global_charts, tables:genre_statistics, policies:global_charts/Global charts are viewable by everyone … |
| 20250916130000_player_achievement_summary.sql | no | 0/1 | views:player_achievement_summary |
| 20250916140000_create_contracts_table.sql | no | 0/6 | tables:contracts, functions:update_contracts_updated_at, policies:contracts/Users can view their own contracts … |
| 20250917090002_fix_label_members_insert_policy.sql | no | 0/1 | policies:label_members/label_members_insert_owner |
| 20250917104500_add_song_collaborators.sql | no | 0/1 | functions:song_collaborator_splits_valid |
| 20250917160000_create_social_campaigns_table.sql | no | 0/7 | tables:social_campaigns, functions:update_social_campaigns_updated_at, policies:social_campaigns/Users can view their campaigns … |
| 20250918090000_create_band_events_table.sql | no | 0/3 | tables:band_events, policies:band_events/Band members can view their events, policies:band_events/Band members can insert events |
| 20251007130559_cab5223d-b43a-423b-9fb7-e102b362f61c.sql | no | 0/5 | policies:band_invitations/Band members can view their band invitations, policies:band_invitations/Band leaders can create invitations, policies:band_invitations/Invited users can respond to invitations … |
| 20251010142523_967c9345-8b0e-4579-b534-b800f41d5af0.sql | no | 0/1 | policies:storage/Users can delete their own avatar |
| 20251102051807_1619680e-9c66-4fdb-8eb5-536f4a0048ac.sql | no | 0/1 | triggers:create_gig_outcome_trigger |
| 20251121093000_add_recording_session_status_rpcs.sql | no | 0/2 | functions:update_recording_session_status, functions:advance_recording_session_stage |
| 20251128162902_a3ab0bea-d366-4f07-a79b-3a00263ce1b8.sql | no | 0/4 | policies:storage/Public read access for stage textures, policies:storage/Authenticated users can upload stage textures, policies:storage/Authenticated users can update stage textures … |
| 20251217152023_250e1ad3-c6bd-49b0-be1e-a28bab1ff6d5.sql | no | 0/3 | policies:storage/Music files are publicly accessible, policies:storage/Authenticated users can upload music, policies:storage/Service role can manage music |
| 20251218182425_a52d47fc-8b7a-4446-a49c-9a686d48217c.sql | yes | 0/2 | policies:profiles/Users can view their own profile, policies:profiles/Users can view band member profiles |
| 20251218182505_9c2a240d-2b88-4b58-af3a-3c75d91a5481.sql | yes | 0/1 | policies:bands/Band members can view their band |
| 20251219113305_06f9d02c-a9d8-4098-94ee-afaa74acde78.sql | no | 0/2 | functions:_normalise_legacy_regional_label_seed, triggers:normalise_legacy_regional_label_seed |
| 20260118075231_7c745b87-5a31-4ff2-a8a3-3abc8bcd29c3.sql | no | 0/7 | policies:companies/View companies, policies:companies/Owner creates company, policies:companies/Owner updates company … |
| 20260118081239_b5ec31c0-be98-4603-a153-544ae398ad2a.sql | no | 0/5 | policies:companies/companies_select_policy, policies:companies/companies_insert_policy, policies:companies/companies_update_policy … |
| 20260129111616_7ceab241-6dd0-41ba-aebd-78af49f08f89.sql | no | 0/2 | policies:storage/Gear images are publicly accessible, policies:storage/Authenticated users can upload gear images |
| 20260201000000_create_global_charts.sql | no | 0/7 | tables:global_charts, functions:update_global_charts_updated_at, functions:update_global_chart_trends … |
| 20260201020002_create_equipment_upgrades_table.sql | no | 0/2 | tables:equipment_upgrades, policies:equipment_upgrades/Equipment upgrades are viewable by everyone |
| 20260201030000_create_social_comments_and_reposts.sql | no | 0/17 | tables:social_comments, tables:social_reposts, functions:update_social_comments_updated_at … |
| 20260202090000_create_fan_messages_table.sql | no | 0/4 | tables:fan_messages, policies:fan_messages/Users can view their fan messages, policies:fan_messages/Users can insert their fan messages … |
| 20260202090001_update_social_posts_with_media_and_schedule.sql | no | 0/4 | policies:storage/Social post media are publicly accessible, policies:storage/Users can upload social post media, policies:storage/Users can update social post media … |
| 20260207094238_fix_legacy_nightclub_city_ids.sql | no | 0/1 | triggers:remap_legacy_nightclub_city_id |
| 20260207101359_26a6379d-b942-4152-8746-1a79424d3b33.sql | no | 0/2 | policies:storage/DikCok thumbnails are publicly accessible, policies:storage/Authenticated users can upload DikCok thumbnails |
| 20260214194728_41afe8ae-119c-42da-a716-c98beaa9d17f.sql | no | 0/1 | functions:revalue_song_quality |
| 20260215005727_2a73cedf-a18d-42c4-b781-29acf90070c7.sql | no | 0/3 | policies:rehearsal_room_upgrades/Authenticated users can insert rehearsal room upgrades, policies:rehearsal_room_upgrades/Authenticated users can update rehearsal room upgrades, policies:rehearsal_room_upgrades/Authenticated users can delete rehearsal room upgrades |
| 20260215090000_create_reset_player_character_function.sql | no | 0/1 | functions:reset_player_character |
| 20260215093000_add_equipment_stock_and_restock.sql | no | 0/2 | functions:purchase_equipment_item, functions:restock_equipment_items |
| 20260216171029_5970d098-c977-4ca8-b05c-e9f3a035acb3.sql | no | 0/3 | policies:storage/Festival posters are publicly accessible, policies:storage/Service role can upload festival posters, policies:storage/Service role can update festival posters |
| 20260220090000_create_public_profiles_view.sql | no | 0/2 | views:public_profiles, policies:profiles/Profile owners can view their data |
| 20260301090000_manage_game_event_status.sql | no | 0/1 | functions:refresh_game_event_statuses |
| 20260301090001_restrict_profile_select.sql | no | 0/1 | policies:profiles/Users can view their own profile |
| 20260301090500_secure_streaming_accounts.sql | no | 0/1 | policies:player_streaming_accounts/Users can view their streaming accounts |
| 20260308203927_e6506e64-28ea-41d0-acda-85ff4de05881.sql | no | 0/3 | policies:storage/Public read access for hub tile images, policies:storage/Service role can upload hub tile images, policies:storage/Service role can update hub tile images |
| 20260310150000_create_gear_shop_snapshots.sql | no | 0/1 | functions:get_gear_shop_item_snapshot |
| 20260313120000_company_shares_and_profit_distribution.sql | no | 0/11 | tables:company_shareholders, tables:company_share_transfers, tables:company_profit_distributions … |
| 20260317120000_award_nomination_lifetime_and_afterparty_rules.sql | no | 0/2 | functions:enforce_award_nomination_rules, triggers:trg_enforce_award_nomination_rules |
| 20260325101000_create_friend_requests_table.sql | no | 0/4 | tables:friend_requests, policies:friend_requests/Participants can view friend requests, policies:friend_requests/Players can create friend requests … |
| 20260412180016_5ebc5352-48cd-4dcd-bd40-bed05c6ae4cf.sql | no | 0/3 | policies:storage/Radio host avatars are publicly accessible, policies:storage/Authenticated users can upload radio host avatars, policies:storage/Authenticated users can update radio host avatars |
| 20260510121805_a7a965e8-1b14-408f-a046-909c303550fe.sql | no | 0/2 | functions:_tour_leg_distance_km, functions:_tour_leg_hours |
| 20260602130000_expand_equipment_categories_and_currency.sql | no | 0/3 | tables:gear_categories, functions:purchase_equipment_item, functions:restock_equipment_items |
| 20260701090000_enhance_equipment_purchase_and_gear_pool.sql | no | 0/10 | tables:gear_slot_catalog, tables:player_gear_pool, tables:player_equipment_ownership_history … |
| 20260711000000_tighten_band_application_select_policy.sql | no | 0/1 | policies:band_applications/Current recruitment managers can view band applications |
| 20260711213000_gig_preshow_incidents.sql | no | 0/14 | tables:gig_preshow_sessions, tables:gig_preshow_incidents, tables:gig_preshow_options … |
| 20260711223000_gig_live_timeline.sql | no | 0/18 | tables:gig_live_sessions, tables:gig_live_segments, tables:gig_live_song_results … |
| 20260712120006_wellness_accommodation_travel_recovery.sql | no | 0/8 | tables:accommodation_recovery_profiles, tables:transport_wellness_profiles, tables:wellness_recovery_events … |
| 20260712120007_wellness_professionals.sql | no | 0/7 | tables:wellness_provider_profiles, tables:wellness_provider_listings, tables:wellness_appointments … |
| 20260712123000_add_skill_mastery_progression.sql | no | 0/17 | tables:skill_specialisations, tables:specialisation_prerequisites, tables:specialisation_effects … |
| 20260712143000_wellness_lifestyle_habits.sql | no | 0/15 | tables:wellness_lifestyle_profiles, tables:wellness_lifestyle_daily_aggregates, tables:wellness_routines … |
| 20260712143001_wellness_time_away_longevity.sql | no | 0/18 | tables:time_away_type_config, tables:time_away_bookings, tables:time_away_itinerary_items … |
| 20260712165000_career_longevity_lifecycle.sql | no | 0/16 | tables:career_wear_summaries, tables:career_lifecycle_history, tables:retirement_transitions … |
| 20260712183000_food_nutrition_hydration_expansion.sql | no | 0/12 | tables:food_definitions, tables:company_food_menu_items, tables:meal_consumption_history … |
| 20260713090000_band_progression_goals.sql | no | 0/20 | tables:band_progression_goals, tables:band_goal_requirements, tables:band_goal_member_tasks … |
| 20260713090001_create_balance_management_registry.sql | no | 0/14 | tables:balance_versions, tables:balance_validation_results, tables:balance_simulation_results … |
| 20260713090002_player_progression_analytics.sql | no | 0/12 | tables:player_progression_snapshots, tables:player_analytics_recommendation_states, tables:player_analytics_exports … |
| 20260713120001_progression_achievements_canonical.sql | no | 0/21 | tables:achievement_criteria, tables:achievement_event_mappings, tables:achievement_rewards … |
| 20260713194500_band_agreements.sql | no | 0/10 | tables:band_agreement_templates, tables:band_agreements, tables:band_agreement_parties … |
| 20260717120001_finance_phase2_player_band_management.sql | no | 0/18 | tables:band_finance_policies, tables:band_finance_role_permissions, tables:band_member_contributions … |
| 20260717170000_finance_phase4_city_economies.sql | no | 0/29 | tables:city_economic_profiles, tables:city_treasury_profiles, tables:city_budgets … |
| 20260717190000_finance_phase5_country_taxation.sql | no | 0/41 | tables:country_economic_profiles, tables:national_treasury_profiles, tables:tax_jurisdictions … |
| 20260717210000_finance_phase6_multi_currency.sql | no | 0/38 | tables:currency_definitions, tables:country_currency_assignments, tables:exchange_rates … |
| 20260719170000_finance_phase7_2_banking_completion.sql | no | 0/3 | views:banking_provider_reconciliation, functions:finance_transfer_accounts, functions:calculate_equal_principal_schedule |
| 20260719190000_finance_phase7_3_banking_completion.sql | no | 0/7 | views:loan_integrity_issues, views:banking_provider_reconciliation, functions:finance_transfer_accounts … |
| 20260719200000_finance_phase7_4_banking_integration.sql | no | 0/19 | views:banking_provider_reconciliation, views:loan_integrity_issues, functions:post_financial_journal … |
| 20260719233000_finance_phase8b1_residential_mortgage_slice.sql | no | 0/33 | views:mortgage_reconciliation_exceptions, functions:ensure_mortgage_provider_accounts, functions:mortgage_monthly_payment … |
| 20260720090000_finance_phase8b2_mortgage_accounting_repair.sql | no | 0/9 | views:mortgage_reconciliation_exceptions, functions:resolve_property_seller_financial_account, functions:release_mortgage_deposit … |
| 20260720103000_finance_phase8b3_mortgage_accounting_kernel.sql | no | 0/11 | functions:post_financial_journal, functions:ensure_development_mortgage_provider, functions:resolve_property_seller_financial_account … |
| 20260720120000_finance_phase8b4_mortgage_band_funding.sql | no | 0/11 | tables:band_financial_contributions, tables:band_expense_payments, tables:band_expense_payment_components … |
| 20260720150000_finance_phase8b7_close_generic_band_expense_endpoint.sql | no | 0/2 | functions:preview_band_expense_funding, functions:resolve_and_pay_band_expense_internal |
| 20260720180000_finance_phase8b8_rehearsal_funding_slice.sql | no | 0/7 | tables:trusted_band_expense_descriptors, tables:band_expense_component_refunds, functions:rehearsal_room_destination_account … |
| 20260723224500_repair_festival_runtime_finance_gates.sql | no | 0/2 | functions:finance_debit_player_personal_cash, functions:festival_test |
| 20260728130001_replace_legacy_gig_travel_trigger.sql | no | 0/2 | functions:check_gig_member_schedule_conflicts, triggers:check_gig_member_schedule_conflicts |
| 20260728223000_authoritative_tour_metadata.sql | no | 0/1 | functions:update_tour_metadata |
| 20260728230000_authoritative_tour_rescheduling.sql | no | 0/1 | functions:reschedule_tour |
| 20260728233000_transactional_tour_travel_repair.sql | no | 0/2 | functions:regenerate_tour_travel_legs, functions:sync_tour_member_travel |
| 20260729093000_atomic_company_founding.sql | no | 0/2 | tables:company_founding_requests, functions:found_company |
| 20260729094500_atomic_company_closure.sql | no | 0/2 | tables:company_closure_requests, functions:close_company |
| 20260729103000_atomic_company_share_offers.sql | no | 0/4 | tables:company_share_offers, functions:propose_company_share_issuance, functions:respond_company_share_offer … |
| 20260729110000_harden_company_profit_distribution.sql | no | 0/1 | functions:distribute_company_annual_profit |
| 20260822144903_city_development_festival_effects.sql | no | 0/3 | functions:_festival_apply_city_development_to_ticket_plan, functions:_evaluate_festival_runtime_incidents, triggers:festival_ticket_plan_city_development |
| 20260822144904_city_development_festival_runtime_hardening.sql | no | 0/1 | functions:_evaluate_festival_runtime_incidents |
| 20260822164000_enforce_gig_city_curfew_and_genres.sql | no | 0/2 | functions:enforce_gig_city_performance_laws, triggers:enforce_gig_city_performance_laws_trigger |
| 20260824111500_finance_a3_treasury_projection_and_recovery.sql | no | 0/3 | functions:sync_band_balance_projection_from_treasury, functions:ensure_my_band_treasury, triggers:band_treasury_sync_legacy_balance_projection |
| 20260825144100_festival_c8_reward_unlock_hooks.sql | no | 0/4 | tables:festival_attendee_reward_unlocks, functions:_festival_c8_create_reward_unlock, functions:get_my_festival_reward_unlocks … |
| 20260830064342_b63b9dca-0103-48f7-accf-99024008340f.sql | yes | 0/1 | functions:debug_travel_dry_run |
| 20260830064535_21019c3a-b6fa-4b44-ac69-1606e5f87977.sql | yes | 0/2 | tables:debug_travel_log, functions:debug_travel_dry_run |
| 20260831180000_finalize_personal_loadouts.sql | no | 0/8 | tables:personal_loadouts, tables:personal_loadout_items, tables:personal_loadout_pedal_slots … |
| 20260908185600_public_merch_storefront_read.sql | no | 0/2 | policies:merch_variants/Authenticated users view sellable merch variants, policies:player_merchandise/Authenticated users view public merchandise |
| 20260910170501_band_clothing_performance_bonus.sql | no | 0/1 | functions:get_band_equipped_clothing_performance_bonus |
| 20260910171500_apply_clothing_bonus_to_gigs.sql | no | 0/3 | functions:band_clothing_performance_bonus_pct, functions:apply_clothing_bonus_to_gig_outcome, triggers:trg_apply_clothing_bonus_to_gig_outcome |
| 20260910182500_clothing_preview_storage.sql | no | 0/4 | policies:storage/Public read clothing previews, policies:storage/Admins upload clothing previews, policies:storage/Admins update clothing previews … |
| 20260921100000_add_sales_metrics_to_global_charts.sql | no | 0/1 | functions:snapshot_global_chart |
| 20260922105500_add_vip_concierge_totp_travel.sql | no | 0/2 | functions:book_vip_totp_concierge_travel, functions:auto_prepare_totp_travel |
| 20260922110000_create_attribute_tables.sql | no | 0/7 | tables:attribute_definitions, tables:profile_attributes, policies:profile_attributes/Profile attributes are viewable by their owner … |
| 20260926231000_festival_atomic_stage_reorder.sql | no | 0/1 | functions:festival_schedule_reorder_stage |
| 20260928160000_backfill_canonical_sponsorship_brand_logos.sql | no | 0/1 | functions:festival_brand_monogram_logo |
| 20260929120000_reconcile_stale_gig_post_processing.sql | no | 0/1 | functions:reconcile_stale_gig_post_processing |
| 20261002083000_complete_higher_tier_learning_access.sql | no | 0/1 | views:skill_learning_source_gaps |
| 20261002094000_bulk_education_skill_access.sql | no | 0/1 | functions:skill_tier_access_bulk |
| 20261003074500_gig_merch_crowd_signals.sql | no | 0/1 | functions:get_gig_merch_crowd_signal |
| 20261003080500_merch_avatar_wearables.sql | no | 0/6 | tables:player_merch_wearables, functions:get_stage_merch_wearables, policies:player_merch_wearables/Players can view own merch wearable … |
| 20261003082000_harden_gig_merch_crowd_signal.sql | no | 0/1 | functions:get_gig_merch_crowd_signal |
| 20261003104500_fix_stage_merch_wearable_visibility.sql | no | 0/1 | functions:get_stage_merch_wearables |
| 20261004215337_harden_luthiery_phase5_browsing.sql | yes | 0/2 | policies:luthiery_shops/Browse open Luthiery shops, policies:luthiery_shop_listings/Browse active Luthiery listings |
| 20261004215752_allow_authoritative_luthiery_shop_transfer.sql | yes | 0/1 | functions:private |
| 20261004220712_hide_closed_luthiery_shop_listings.sql | yes | 0/1 | policies:luthiery_shop_listings/Browse active Luthiery listings |
| 20261006082500_luthiery_career_learning_routes.sql | no | 0/1 | views:luthiery_learning_source_gaps |
| 20261012230900_atomic_songwriting_skip_completion.sql | no | 0/1 | functions:skip_and_complete_songwriting_project |
| 20261013155000_atomic_character_recovery.sql | no | 0/1 | functions:create_recovery_character_atomic |
| 20261013170000_atomic_retirement_finalization.sql | no | 0/1 | functions:finalize_character_retirement |
| 20261013184000_achievement_event_reward_integrity.sql | no | 0/5 | tables:achievement_processed_events, tables:achievement_reward_settlements, functions:achievement_event_criteria_met … |
| 20261031120000_create_profile_progression_tables.sql | no | 0/28 | tables:profile_action_xp_events, tables:profile_weekly_bonus_claims, tables:profile_attribute_transactions … |
| 20261031123000_create_progression_functions.sql | no | 0/7 | functions:progression_award_action_xp, functions:progression_award_weekly_bonus, functions:progression_buy_attribute_star … |
| 20261105090000_create_radio_play_metrics_functions.sql | no | 0/2 | functions:get_radio_station_play_summary, functions:get_radio_station_play_timeline |
| 20261111090000_create_brand_sponsorships.sql | no | 0/5 | tables:brand_partners, tables:brand_offers, tables:brand_contracts … |
| 20261201000000_add_check_radio_submission_week.sql | no | 0/1 | functions:check_radio_submission_week |
| 20261201090000_create_skills_table.sql | no | 0/1 | tables:skills |
| 20270415100000_add_city_of_birth_to_profiles.sql | no | 0/1 | views:public_profiles |
| 20270430100000_add_profile_city_gender_age.sql | no | 0/1 | views:public_profiles |
| 20270431163000_daily_login_attribute_bonus.sql | no | 0/1 | functions:process_daily_login_attribute_bonus |
| 20270602100000_create_education_band_sessions.sql | no | 0/4 | tables:education_band_sessions, policies:education_band_sessions/Band sessions are viewable by everyone, policies:education_band_sessions/Privileged roles manage band sessions … |
| 20270607120000_expand_song_quality_scale.sql | no | 0/1 | functions:simulate_song_growth |
| 20270612150000_update_ensure_player_attributes.sql | no | 0/1 | functions:ensure_player_attributes |
| 20270624110000_update_cities_policies.sql | no | 0/1 | policies:cities/Admin manage cities |
| 20270630100000_create_studio_infrastructure.sql | no | 0/17 | tables:studios, tables:studio_bookings, tables:studio_booking_slots … |
| 20270712120000_create_canonical_skill_catalogue.sql | no | 0/11 | tables:skill_attribute_links, tables:skill_prerequisites, tables:skill_unlock_routes … |
| 20270712150000_progression_balance_v2.sql | no | 0/1 | tables:progression_balance_versions |
| 20270712170000_add_skill_maintenance.sql | no | 0/5 | tables:player_skill_sharpness, tables:skill_maintenance_events, views:admin_skill_maintenance_diagnostics … |
| 20271115090000_create_songwriting_draft_tables.sql | no | 0/2 | tables:songwriting_drafts, tables:songwriting_draft_revisions |
| 20291202090000_beta_rls_hardening.sql | no | 0/13 | tables:admin_action_audit, policies:profile_skill_progress/Users can view their own skill progress, policies:profile_skill_unlocks/Users can view their own skill unlocks … |
| 20291217100000_finalise_festival_operations_summary.sql | no | 0/2 | functions:festival_safe_jsonb_nonnegative_integer, functions:festival_edition_operations_summary_internal |
| 20291217161000_complete_festival_staffing_supplier_workflows.sql | no | 0/27 | tables:festival_operations_communications, functions:_festival_operations_authorised, functions:_festival_supplier_authorised … |
| 20291217170000_festival_sponsorship_and_partnerships.sql | no | 0/39 | tables:festival_sponsorship_plans, tables:festival_sponsor_categories, tables:festival_sponsorship_inventory … |
| 20291217171000_complete_festival_sponsorship_workflows.sql | no | 0/23 | functions:_festival_sponsor_company_authorised, functions:_festival_sponsorship_authorised, functions:_festival_sponsorship_begin_action … |
| 20291217210000_festival_crowds_incidents_and_operations.sql | no | 0/49 | tables:festival_runtime_weather, tables:festival_runtime_crowds, tables:festival_runtime_stage_crowds … |
| 20291217220000_authoritative_festival_edition_scheduling.sql | no | 0/6 | functions:festival_edition_for_legacy_id, functions:legacy_festival_create_edition_stage, functions:legacy_festival_create_performance_slot … |
| 20291218000000_complete_festival_runtime_worker_boundary.sql | no | 0/9 | tables:festival_performance_resolution_requests, tables:festival_performance_simulation_requeue_audit, functions:resolve_festival_performance … |
| 20291218010000_festival_cross_phase_contracts.sql | no | 0/9 | tables:festival_simulation_worker_invocations, functions:_festival_runtime_performance_projection, functions:_festival_runtime_outcome_projection … |
| 20291218020000_festival_runtime_v2_hardening.sql | no | 0/6 | functions:_festival_runtime_outcome_projection, functions:assert_festival_runtime_outcome_v2, functions:_assert_festival_runtime_finalisation_complete … |
| 20291218030000_festival_settlement_v2.sql | no | 0/10 | tables:festival_settlement_liabilities, tables:festival_settlement_line_components, tables:festival_tax_calculations … |
| 20291218040000_execute_festival_settlement_v2.sql | no | 0/1 | functions:prepare_festival_settlement |
| 20291218050000_native_festival_settlement_v2.sql | no | 0/7 | tables:festival_settlement_preparation_requests, tables:festival_settlement_contract_snapshots, functions:festival_json_content_digest … |
| 20291218060000_auditable_festival_settlement_v2.sql | no | 0/20 | tables:festival_staff_shift_evidence_decisions, functions:_assert_festival_settlement_source_chain, functions:_assert_festival_settlement_evidence … |
| 20291218070000_complete_festival_settlement_v2.sql | no | 0/17 | tables:festival_settlement_processing_requests, functions:_festival_settlement_identity, functions:_assert_festival_settlement_source_chain … |
| 20291218080000_repair_festival_settlement_execution.sql | no | 0/17 | tables:festival_launch_identity_backfill_audit, functions:_build_festival_contract_package, functions:festival_contract_package_digest … |
| 20291218090000_native_festival_settlement_execution.sql | no | 0/10 | tables:festival_plan_edition_backfill_audit, functions:_assert_festival_plan_edition_owner, functions:_build_festival_contract_package … |
| 20291218100000_festival_settlement_v3_forward_corrections.sql | no | 0/19 | tables:festival_plan_identity_repairs, tables:festival_settlement_effect_receipts, functions:_festival_plan_is_used … |
| 20291218110000_finish_festival_settlement_v3.sql | no | 0/15 | tables:festival_staff_overtime_requests_v3, tables:festival_staff_overtime_decisions_v3, functions:_festival_immutable_row … |
| 20291218120000_complete_festival_settlement_obligations.sql | no | 0/11 | functions:_festival_overtime_chain_guard, functions:request_festival_staff_overtime, functions:decide_festival_staff_overtime … |
| 20291218130000_native_festival_obligations_and_finalisation.sql | no | 0/10 | tables:festival_settlement_finalisation_requests, tables:festival_settlement_effect_destinations, functions:_may_read_festival_overtime … |
| 20291218140000_festival_native_preparation_finalisation_repair.sql | no | 0/4 | functions:_build_festival_contract_package_native_v6, functions:prepare_festival_settlement, functions:finalise_festival_settlement … |
| 20291218150000_festival_settlement_v6_integrity_hardening.sql | no | 0/3 | functions:_festival_native_component_guard, functions:_festival_component_total_guard, triggers:festival_component_total_guard |
| 20291218160000_festival_settlement_canonical_evidence.sql | no | 0/6 | tables:festival_settlement_repair_diagnostics, functions:_festival_component_provenance_canonical, functions:_assert_festival_runtime_plan_evidence … |
| 20291218170000_festival_settlement_full_reconciliation.sql | no | 0/8 | tables:festival_settlement_reconciliation_reports, functions:_festival_settlement_reconciliation_v7, functions:_festival_assert_reconciled_v7 … |
| 20291218180000_festival_lifecycle_recovery.sql | no | 0/17 | tables:festival_lifecycle_operations, tables:festival_lifecycle_transitions, tables:festival_repair_audit … |
| 20291218190000_operationalise_festival_lifecycle_recovery.sql | no | 0/21 | tables:festival_payment_resolution_authorisations, tables:festival_recovery_quarantine, tables:festival_effect_dependency_rules … |
| 20291218200000_close_festival_recovery_authority_gaps.sql | no | 0/9 | functions:_festival_worker_trusted, functions:_festival_lifecycle_authorised, functions:_claim_festival_lifecycle_operation … |
| 20291218210000_make_festival_operation_claims_executable.sql | no | 0/2 | functions:_claim_festival_lifecycle_operation, functions:_festival_payment_terminal_guard |
| 20291218220000_fence_festival_lifecycle_workers.sql | no | 0/5 | functions:_complete_festival_lifecycle_operation, functions:_fail_festival_lifecycle_operation, functions:_festival_physical_lifecycle_state … |
| 20291218242100_harden_canonical_savings_goal_compatibility.sql | no | 0/3 | functions:sync_savings_goal_legacy_profile_id, functions:fund_my_savings_goal, triggers:trg_sync_savings_goal_legacy_profile_id |
| 20291218242310_harden_financial_transfer_idempotency.sql | no | 0/1 | functions:_move_financial_account_money |
| 20291218242550_repair_financial_move_currency_entries.sql | no | 0/1 | functions:_move_financial_account_money |
| 20291218242600_atomic_charity_donations.sql | no | 0/1 | functions:make_my_charity_donation |
| 20291218242800_standardise_profile_activity_end_times.sql | no | 0/2 | functions:sync_profile_activity_status_ends_at, triggers:profile_activity_statuses_sync_ends_at |
| 20291218243000_reconcile_auth_signup_trigger.sql | no | 0/1 | triggers:on_auth_user_created |
| 20291218243410_fix_label_release_status_trigger.sql | no | 0/1 | functions:handle_release_status_change |
| 20291218243420_repair_song_collaborator_constraints.sql | no | 0/1 | functions:song_collaborator_splits_valid |
| 20291218243520_reconcile_band_invitation_schema.sql | no | 0/5 | policies:band_invitations/Band members can view their band invitations, policies:band_invitations/Band leaders can create invitations, policies:band_invitations/Invited users can respond to invitations … |
| 20291218244000_festival_settlement_effect_lifecycle.sql | no | 0/3 | functions:claim_next_festival_settlement_effect, functions:acknowledge_festival_settlement_effect, functions:finalise_festival_settlement_effects |
| 20291218244400_fail_closed_festival_canonical_effects.sql | no | 0/4 | functions:_festival_effect_authority_context, functions:_festival_apply_canonical_effect, functions:_festival_assert_canonical_result … |
| 20291218244401_require_complete_festival_canonical_evidence.sql | no | 0/1 | functions:_festival_assert_canonical_result |
| 20291218244500_shared_live_performance_progression.sql | no | 0/13 | tables:live_performance_outcomes, tables:band_fan_progression_events, tables:band_fame_progression_events … |
| 20291218244600_repair_live_performance_progression.sql | no | 0/12 | functions:_prepare_live_performance_outcome, functions:normalise_live_performance_score, functions:live_performance_canonical_record_type … |
| 20291218244700_certify_live_performance_progression.sql | no | 0/17 | tables:live_performance_progression_repairs, functions:calculate_live_performance_fans, functions:calculate_live_performance_fame … |
| 20291218244800_certify_festival_core_progression_authorities.sql | no | 0/4 | tables:live_performance_chemistry_events, functions:apply_festival_member_xp_to_wallet, functions:_festival_canonical_record_exists … |
| 20291218252000_city_festival_permit_authority.sql | no | 0/4 | tables:city_festival_permits, functions:_festival_city_law_for_edition, policies:city_festival_permits/city_festival_permits_authorized_read … |
| 20291219020000_festival_performance_resolution_authority.sql | no | 0/7 | tables:festival_performance_resolution_inputs, functions:prevent_festival_resolution_evidence_mutation, functions:resolve_festival_performance … |
| 20291219050000_festival_ticket_vendor_analytics_closure.sql | no | 0/30 | tables:festival_ticket_dynamic_pricing_rules, tables:festival_ticket_price_history, tables:festival_commerce_requests … |
| 20291219060000_festival_b7_direct_invitation_projection.sql | no | 0/2 | functions:list_my_festival_artist_invitations, functions:respond_to_festival_edition_artist_invitation |
| 20291219090000_festival_c2_attendee_lifecycle.sql | no | 0/15 | tables:festival_player_attendance_events, functions:_festival_prepare_attendance_transition, functions:_festival_audit_attendance_transition … |
| 20291220090000_link_festival_sponsors_to_canonical_brands.sql | no | 0/1 | views:festival_eligible_sponsorship_brands |
| 20291220092000_enforce_festival_sponsor_slots.sql | no | 0/2 | functions:festival_enforce_sponsor_slots, triggers:festival_enforce_sponsor_slots_trigger |
| 20291220093000_festival_sponsor_slot_readiness.sql | no | 0/1 | views:festival_sponsor_slot_readiness |
| 20291220095000_require_festival_main_sponsor_at_launch.sql | no | 0/2 | functions:festival_require_main_sponsor_at_launch, triggers:festival_require_main_sponsor_at_launch_trigger |
| 20291220096000_add_festival_canonical_brand_prospect.sql | no | 0/1 | functions:add_festival_canonical_brand_prospect |
| 20291220097000_preserve_automatic_festival_sponsor_launch.sql | no | 0/1 | functions:festival_require_main_sponsor_at_launch |
| 20291220104300_atomic_simplified_artist_payouts.sql | no | 0/2 | tables:festival_simplified_artist_payouts, functions:_pay_simplified_festival_artist_bookings |
| 20291220104400_audited_premature_festival_rerun.sql | no | 0/2 | tables:festival_simplified_rerun_archives, functions:prepare_premature_simplified_festival_rerun |
| 20300106200000_atomic_personal_funded_gig_booking.sql | no | 0/1 | functions:book_gig_with_personal_funding |
| 20300106200000_secure_atomic_weekly_band_payroll.sql | no | 0/2 | tables:band_weekly_payroll_settlements, functions:process_weekly_band_payroll |
| 20300106201000_controlled_random_event_backlog_reconciliation.sql | no | 0/2 | tables:random_event_reconciliation_audit, functions:reconcile_random_event_backlog |

## Partial (233)

| Script | In history | Present | Example missing objects |
|---|---|---|---|
| 20250602120001_create_personal_loadouts.sql | no | 1/5 | tables:gear_items, policies:gear_items/Gear catalog readable by everyone, policies:gear_items/Gear catalog managed by service role … |
| 20250916075501_1adc3330-58fe-4fde-85d0-b13e1e788c85.sql | yes | 33/45 | policies:profiles/Profiles are viewable by everyone, policies:player_skills/Skills are viewable by everyone, policies:bands/Bands are viewable by everyone … |
| 20250916081629_c5c74efe-b5cd-4bd7-9b25-0cda3f8be4d6.sql | no | 24/30 | policies:player_equipment/Users can manage their own equipment, policies:streaming_platforms/Streaming platforms are viewable by everyone, policies:storage/Avatar images are publicly accessible … |
| 20250916150000_create_notifications_table.sql | no | 1/16 | tables:record_labels, tables:streaming_campaigns, functions:update_record_labels_updated_at … |
| 20250916153000_add_contract_recoupment_fields.sql | no | 10/28 | tables:competitions, tables:competition_participants, tables:player_rankings … |
| 20250916160000_create_band_invitations_table.sql | no | 1/6 | policies:band_invitations/Band invitations are viewable by everyone, policies:band_invitations/Band leaders can create invitations, policies:band_invitations/Band leaders can update invitations … |
| 20250917090000_create_label_system.sql | no | 16/58 | tables:label_members, tables:label_reputation_events, tables:promotion_campaigns … |
| 20250917170000_create_band_relations_tables.sql | no | 1/8 | tables:band_relations, policies:band_relations/Band members can view relation stats, policies:band_relations/Band leaders can manage relation stats … |
| 20250920135913_6eb1b596-a672-4450-a6b9-557068e5b641.sql | no | 11/15 | policies:friendships/Users can create friendships, policies:friendships/Users can update their friendships, policies:player_skills/Users can view all player skills … |
| 20251006052802_4b82ad0e-e2a8-49b5-a82f-9cca1bc0d525.sql | no | 1/7 | functions:set_profile_activity_status_updated_at, functions:sync_profile_activity_status_ends_at, policies:profile_activity_statuses/Profile activity statuses are viewable by everyone … |
| 20251007132130_96a568d6-31eb-4de4-aca5-74830ac88225.sql | no | 11/12 | policies:city_studios/City studios are viewable by everyone |
| 20251010143053_54d832de-bd02-4981-9df9-01de3ef116c0.sql | no | 7/8 | policies:rehearsal_rooms/Rehearsal rooms are viewable by everyone |
| 20251012090000_create_casting_calls_workflow.sql | no | 4/7 | triggers:casting_calls_set_updated_at, triggers:casting_submissions_set_updated_at, triggers:casting_reviews_set_updated_at |
| 20251013054723_7ccda721-13cc-4289-950b-54ae35e41898.sql | no | 1/3 | policies:friendships/Users can create friendships, policies:friendships/Users can update their friendships |
| 20251013055241_c10c74eb-8ee4-48ec-90e1-fe4dbe467fe0.sql | no | 36/38 | policies:twaater_accounts/Band leaders can create band twaater accounts, policies:twaats/Account owners can delete their twaats |
| 20251014055214_6e240615-78f7-44bf-aeb1-a1c1c39834a5.sql | no | 2/3 | triggers:on_twaat_created_award_xp |
| 20251015104755_321f0ed2-9ad5-4a06-b14b-e3128041cccc.sql | yes | 1/3 | policies:friendships/Users can create friendships, policies:friendships/Users can update their friendships |
| 20251016083610_47881b29-3e5a-43e6-92f5-23d8fcfac7c5.sql | no | 8/11 | policies:setlist_songs/Band members can view setlist songs, policies:setlist_songs/Band members can add songs to setlists, policies:setlist_songs/Band members can remove songs from setlists |
| 20251016084400_ee0afa77-eacf-408d-96ec-7e7ce39f3558.sql | no | 16/21 | policies:band_crew_members/Band members can manage their crew, policies:gig_song_performances/Band members can view their gig performances, policies:gig_song_performances/Band members can create gig performances … |
| 20251016144909_41e4397a-108e-44ac-a110-907e512ac3de.sql | no | 4/6 | policies:band_song_familiarity/Band members can view their song familiarity, policies:band_song_familiarity/Band members can update their song familiarity |
| 20251017055422_e28aa80f-6feb-49a1-9d1d-2621413f9d51.sql | no | 2/4 | policies:twaater_suggested_follows/System can insert suggestions, policies:twaater_suggested_follows/System can delete suggestions |
| 20251101120000_implement_stage_equipment_system.sql | no | 2/7 | tables:band_equipment_maintenance_logs, policies:band_vehicles/Band members can manage their vehicles, policies:band_equipment_maintenance_logs/Band members can view equipment logs … |
| 20251116081455_b656d8bc-8184-4de7-b40d-71793921f362.sql | no | 18/22 | tables:music_video_metrics, policies:music_video_metrics/Users can view their music video metrics, policies:music_video_metrics/Users can manage their music video metrics … |
| 20251116120405_d8614900-0780-4f50-8d33-8dd667d16629.sql | no | 20/22 | policies:player_skill_books/Users can view their own books, policies:player_skill_books/Users can manage their own books |
| 20251116123007_6d2c4860-40e6-4a54-ba2c-111836c84ef6.sql | no | 17/19 | policies:player_equipment_inventory/Users can view their own inventory, policies:player_equipment_inventory/Users can manage their own inventory |
| 20251128154207_0cb3de34-389f-498a-8da4-045cc719e777.sql | no | 33/40 | policies:twaater_notifications/System can create notifications, policies:twaater_polls/Anyone can view polls, policies:twaater_poll_options/Anyone can view poll options … |
| 20251216081506_9f11e417-e592-4489-ba1d-0b90796af42d.sql | no | 8/9 | policies:game_balance_config/Service role can modify game balance |
| 20251216194006_6c2b0258-6325-46f4-8da4-6dbeaf8ea51a.sql | no | 4/5 | policies:promotional_campaigns/Users can create campaigns for their releases |
| 20251217172234_d28ed50d-608d-4248-a6ce-0b63a10ff95d.sql | no | 7/8 | policies:player_events/Users can update their own events |
| 20251218183758_4c9da065-6579-4ebd-81c4-7b444a87ee3b.sql | no | 1/2 | policies:profiles/Authenticated users can view profiles |
| 20251224044818_9d8be14a-a673-410b-b535-08f0bb5b0992.sql | no | 1/2 | triggers:on_songwriting_project_complete |
| 20260116130530_11fcaf24-c9ae-488a-9ca3-fba8aae5cf6a.sql | no | 3/6 | policies:storage/Anyone can view crowd sound files, policies:storage/Admins can upload crowd sounds, policies:storage/Admins can delete crowd sounds |
| 20260117171301_036e966f-3d94-4de1-befb-2df92a6ae3f1.sql | no | 13/18 | policies:companies/Users can view their own companies, policies:companies/Users can view companies they work for, policies:companies/VIP users can create companies … |
| 20260117195950_f16046d5-b6d5-473c-863f-fb882f822bb3.sql | no | 11/12 | policies:rehearsal_room_upgrades/Company owners can manage rehearsal room upgrades |
| 20260117211153_f4d192cb-8bcb-4538-9e74-0d83eb44c27e.sql | no | 3/6 | policies:venues/Company owners can view their venues, policies:city_studios/Company owners can view their studios, policies:rehearsal_rooms/Company owners can view their rehearsal rooms |
| 20260126204612_05620a99-7ca6-42c0-925d-9f48bd173c96.sql | no | 24/25 | policies:city_laws/Only mayors can update their city laws |
| 20260128194808_5dc22123-ef88-478f-9943-3be0befffea5.sql | no | 3/7 | policies:storage/Character sprites are publicly accessible, policies:storage/Admins can upload character sprites, policies:storage/Admins can update character sprites … |
| 20260201020001_create_chat_participants_table.sql | no | 3/7 | policies:chat_participants/Users manage their own presence, policies:chat_participants/Users update presence when not muted, policies:chat_participants/Users can leave chat when not muted … |
| 20260201020003_create_fan_campaigns_table.sql | no | 1/5 | policies:fan_campaigns/Users can view their fan campaigns, policies:fan_campaigns/Users can insert their fan campaigns, policies:fan_campaigns/Users can update their fan campaigns … |
| 20260201020005_schedule_event_reminder_job.sql | no | 2/4 | functions:process_schedule_event_reminders, policies:notifications/Users and services can insert notifications |
| 20260206141144_f2e5d9ac-3547-4bf0-b8aa-2bb4f2b5a143.sql | no | 16/18 | policies:award_nominations/Users can submit nominations, policies:award_votes/Users can cast votes |
| 20260216075006_3f4261d4-2129-40a8-be59-3c174770c36d.sql | no | 7/11 | policies:major_event_performances/Users can view their own performances, policies:major_event_performances/Users can insert their own performances, policies:major_event_performances/Users can update their own performances … |
| 20260216080831_40552ed0-d576-43d2-a189-1899ee4a9b2f.sql | no | 13/16 | policies:storage/Housing images are publicly accessible, policies:storage/Service role can upload housing images, policies:storage/Service role can update housing images |
| 20260216190021_1c5623c8-859e-4443-bbe5-a9a2a35bccbb.sql | no | 5/7 | policies:storage/Anyone can view merch images, policies:storage/Authenticated users can upload merch images |
| 20260305075457_d57c54c7-0efc-40cf-a72d-9f865da73b6e.sql | no | 2/6 | policies:storage/Public read access for practice tracks, policies:storage/Authenticated upload practice tracks, policies:storage/Authenticated update practice tracks … |
| 20260305100000_extend_profiles_with_biographical_fields.sql | no | 1/3 | views:public_profiles, functions:reset_player_character |
| 20260308121108_c205742b-97d4-4d13-a1f3-08bfb966b906.sql | no | 5/9 | policies:player_tattoos/Users can view own tattoos, policies:player_tattoos/Users can insert own tattoos, policies:player_tattoos/Users can update own tattoos … |
| 20260316093001_fix_promotional_campaigns_rls.sql | no | 2/3 | policies:promotional_campaigns/Users can create campaigns for their releases |
| 20260316144740_a7886da5-7860-43fc-afae-044c118f1be6.sql | no | 1/5 | policies:band_applications/Users can view own applications, policies:band_applications/Users can apply to bands, policies:band_applications/Leaders can view band applications … |
| 20260316170000_fix_setlist_rls_for_band_leaders.sql | no | 7/10 | policies:setlist_songs/Band members can view setlist songs, policies:setlist_songs/Band members can add songs to setlists, policies:setlist_songs/Band members can remove songs from setlists |
| 20260317093000_expand_award_shows_invites_and_script.sql | no | 1/3 | policies:award_show_invites/Award invites are viewable by everyone, policies:award_show_invites/Invitees can respond to invites |
| 20260401090000_create_universities_table.sql | no | 2/4 | policies:universities/Service roles can manage universities, triggers:set_universities_updated_at |
| 20260416134302_e5408e79-1899-4c19-aa5f-4194075d499b.sql | no | 10/16 | policies:player_crafting_materials/Players can insert own materials, policies:player_crafting_materials/Players can update own materials, policies:player_crafting_materials/Players can delete own materials … |
| 20260424104428_37199ec8-545e-4e3d-bd55-c542eb14fb1b.sql | no | 7/8 | policies:relationship_xp_log/Players can insert their own relationship XP log |
| 20260427091345_34e5adc6-026e-4691-b92d-09aa562257ef.sql | no | 16/17 | triggers:trg_mirror_band_gift_notification |
| 20260630133409_4c399d77-f106-4d6c-8d9f-07578a2cd500.sql | no | 29/30 | policies:company_storefront/Anyone can view storefronts |
| 20260630134122_881e42d4-3642-4b1d-aeec-e9ac657b144e.sql | no | 18/21 | policies:company_inventory/Anyone reads inventory, policies:company_services/Anyone reads services, policies:company_news_events/Anyone reads company news |
| 20260709120000_secure_crypto_token_trades.sql | no | 1/3 | policies:player_token_holdings/Admins can manage token holdings, policies:token_transactions/Admins can create token transactions |
| 20260710120000_add_profile_privacy_settings.sql | no | 6/9 | policies:profile_privacy_settings/Profile owners can view their privacy settings, policies:profile_privacy_settings/Profile owners can create their privacy settings, policies:profile_privacy_settings/Profile owners can update their privacy settings |
| 20260710120001_beta_admin_support_tools.sql | no | 1/8 | tables:admin_action_audit, functions:admin_search_players, functions:admin_get_player_support_summary … |
| 20260710120002_complete_company_recruitment_lifecycle.sql | no | 9/15 | functions:calculate_company_job_suitability, policies:company_job_applications/Applications are created through recruitment RPC, policies:company_job_applications/Applications are updated through recruitment RPC … |
| 20260710133000_add_social_safety_primitives.sql | no | 7/19 | tables:social_profile_blocks, tables:social_profile_mutes, tables:social_reports … |
| 20260710150000_guard_direct_message_sends.sql | no | 1/2 | policies:direct_messages/DM insert by guarded RPC or sender |
| 20260710170000_guard_friend_request_sends.sql | no | 1/3 | functions:can_send_friend_request, policies:friendships/Requesters can create guarded pending friendships |
| 20260710183000_guard_social_invites.sql | no | 2/4 | functions:can_send_social_invite, policies:social_invites/Invite created by guarded sender |
| 20260710200000_public_safe_profile_search.sql | no | 1/3 | views:public_safe_profiles, functions:can_view_public_profile_summary |
| 20260710220000_guard_band_invitation_creation.sql | no | 2/3 | policies:band_invitations/Band invitation creation uses guarded RPC |
| 20260710231000_guard_band_invitation_responses.sql | no | 2/3 | policies:band_invitations/Band invitation responses use guarded RPC |
| 20260710232000_guard_band_application_responses.sql | no | 2/3 | policies:band_applications/Band application responses use guarded RPC |
| 20260710234000_guard_band_application_submission.sql | no | 1/2 | policies:band_applications/Band application submissions use guarded RPC |
| 20260711001000_company_weekly_finances_recruitment.sql | no | 5/10 | policies:company_weekly_finance_records/Company owners view weekly finances, policies:company_vacancies/Anyone can browse open company vacancies, policies:company_job_applications/Applicants and owners view applications … |
| 20260711030000_rehearsal_attendance_gig_lineups_bootstrap.sql | no | 17/19 | functions:validate_gig_performer, triggers:validate_gig_performer |
| 20260711090000_rehearsal_self_response_mvp.sql | no | 2/6 | functions:rehearsal_rsvp_lock_interval, functions:rehearsal_rsvp_deadline, functions:is_rehearsal_participant_final … |
| 20260711100000_rehearsal_attendance_finalisation.sql | no | 2/3 | functions:is_rehearsal_attendance_finalisation_open |
| 20260711110000_rehearsal_attendance_corrections.sql | no | 3/9 | functions:rehearsal_attendance_correction_window, functions:rehearsal_attendance_correction_deadline, functions:is_rehearsal_attendance_correction_open … |
| 20260711120000_rehearsal_attendance_correction_hardening.sql | no | 3/5 | functions:has_alternative_rehearsal_correction_resolver, functions:get_rehearsal_attendance_correction_resolution_eligibility |
| 20260711123000_gig_setlists_readiness.sql | no | 3/9 | policies:gig_setlists/Band members can view gig setlists, policies:gig_setlists/Band managers can insert gig setlists, policies:gig_setlists/Band managers can update gig setlists … |
| 20260711140000_phase_5_pr_05_gig_viewer_replays.sql | no | 2/8 | functions:set_gig_viewer_replay_updated_at, policies:gig_viewer_replays/gig_viewer_replays_select_matches_outcome_visibility, policies:gig_viewer_replays/gig_viewer_replays_deny_insert … |
| 20260711150000_gig_crew_equipment_preparation.sql | no | 5/14 | tables:gig_preparation_cost_ledger, tables:gig_crew_reward_ledger, functions:calculate_gig_crew_effectiveness … |
| 20260711161000_gig_stage_production_soundcheck.sql | no | 5/10 | functions:gig_production_estimate, policies:gig_production_plans/Band members can view gig production plans, policies:gig_production_plans/Band managers can manage gig production plans … |
| 20260711200000_gig_forecast_final_review.sql | no | 2/5 | policies:gig_forecast_snapshots/Band members can view gig forecasts, policies:gig_forecast_snapshots/Band managers can insert gig forecasts, policies:gig_forecast_snapshots/Band managers can update gig forecasts |
| 20260712090000_post_gig_consequences_live_reputation.sql | no | 4/14 | tables:band_live_reputation_scopes, tables:gig_booking_opportunities, functions:expire_gig_booking_opportunities … |
| 20260712120000_expand_wellness_foundation.sql | no | 1/4 | tables:wellness_history, functions:calculate_overall_wellness, functions:wellness_state |
| 20260712120001_gig_audience_participation.sql | no | 6/31 | tables:gig_audience_polls, tables:gig_audience_poll_votes, tables:gig_audience_ratings … |
| 20260712120004_songwriting_outcome_calculator.sql | no | 2/7 | functions:songwriting_skill_level, functions:songwriting_attribute_value, functions:songwriting_genre_slug … |
| 20260712120005_tour_operations_multi_gig_management.sql | no | 9/27 | policies:tour_operation_templates/Band members view tour operation templates, policies:tour_operation_templates/Band leaders manage tour operation templates, policies:tour_operation_states/Band members view tour operation states … |
| 20260713120000_player_profiles_social_identity.sql | no | 2/12 | tables:player_profile_badges, tables:player_profile_activity, tables:player_career_milestones … |
| 20260713130000_band_relationship_progression.sql | no | 1/11 | tables:player_relationships, tables:band_chemistry_snapshots, tables:relationship_balance_config … |
| 20260713130002_player_discovery_search_matchmaking.sql | no | 7/10 | tables:player_discovery_profiles, functions:player_discovery_match_score, policies:player_saved_searches/Players manage their saved discovery searches |
| 20260713170000_band_recruitment_lifecycle.sql | no | 4/17 | tables:band_membership_offers, tables:saved_band_vacancies, tables:band_recruitment_candidates … |
| 20260713180000_friendship_management_foundation.sql | no | 4/6 | tables:friendship_settings, policies:friendship_settings/Owners manage friendship settings |
| 20260713193000_band_roles_permissions_responsibilities.sql | no | 1/28 | tables:band_permission_catalogue, tables:band_roles, tables:band_role_permissions … |
| 20260713193001_private_messaging_conversations.sql | no | 7/14 | tables:message_attachments, functions:direct_pair_key, functions:is_conversation_participant … |
| 20260713195500_social_activities_foundation.sql | no | 5/14 | tables:social_activity_catalog, tables:social_preferences, tables:social_activity_outcomes … |
| 20260713210000_band_governance_proposals.sql | no | 1/22 | tables:band_governance_settings, tables:band_proposal_type_policies, tables:band_proposals … |
| 20260717120000_admin_festival_creation_phase1.sql | no | 7/9 | functions:tg_festival_stage_edition_consistency, triggers:tg_festival_stage_edition_consistency |
| 20260717153000_finance_phase3_company_operations.sql | no | 3/19 | tables:company_financial_profiles, tables:company_cost_profiles, tables:employment_role_definitions … |
| 20260717153001_harden_festival_creation_phase1_forward.sql | no | 6/7 | functions:internal_create_festival_edition_setup |
| 20260718060607_4fccefa8-b186-4a6d-a823-4b53f508adf4.sql | yes | 15/16 | policies:festival_admin_audit_events/festival_admin_audit_admin_read |
| 20260719120000_finance_phase7_banking_credit.sql | no | 1/38 | tables:banking_providers, tables:banking_customer_profiles, tables:deposit_interest_accruals … |
| 20260719143000_finance_phase7_1_banking_hardening.sql | no | 1/30 | tables:banking_provider_financial_accounts, tables:loan_payment_attempts, functions:is_service_role … |
| 20260719210000_finance_phase7_5_savings_personal_banking.sql | no | 1/10 | tables:savings_products, tables:fixed_deposits, tables:deposit_protection_schemes … |
| 20260719220000_finance_phase8b_persistent_mortgages.sql | no | 1/57 | tables:property_districts, tables:property_templates, tables:properties … |
| 20260720133000_finance_phase8b5_obligations_credit.sql | no | 5/21 | tables:financial_obligation_policies, tables:financial_obligation_attempts, tables:financial_obligation_events … |
| 20260720143000_finance_phase8b6_security_correctness_band_funding.sql | no | 7/22 | functions:reconcile_financial_obligation_state, functions:record_financial_obligation_event_internal, functions:record_financial_obligation_event … |
| 20260720201000_finance_phase8b10_band_treasury_dashboard.sql | no | 3/4 | functions:is_bank_account_eligible_for_outgoing_payment |
| 20260720213000_finance_band_treasury_consolidation.sql | no | 5/6 | functions:is_bank_account_eligible_for_outgoing_payment |
| 20260722102540_b1796c0a-adea-432b-8880-ed3e37b89a2c.sql | yes | 19/20 | policies:bank_accounts/Users manage own bank accounts |
| 20260723153000_harden_festival_company_founding.sql | no | 2/4 | functions:_festival_company_creation_enabled, functions:_festival_company_limit |
| 20260723170000_fix_festival_single_charge_rollout.sql | no | 3/7 | functions:_festival_company_creation_enabled, functions:_festival_company_management_enabled, functions:company_ownership_limit … |
| 20260723193000_festival_runtime_gate_capabilities.sql | no | 4/9 | functions:festival_company_ownership_limit, functions:can_profile_found_festival_company, functions:company_ownership_limit … |
| 20260723210000_secure_festival_runtime_gate.sql | no | 1/4 | functions:_festival_test_fixtures_allowed, functions:company_ownership_limit, functions:can_profile_found_company |
| 20260723223000_trusted_festival_runtime_gate.sql | no | 1/6 | tables:festival_test, functions:festival_test, functions:_festival_test_context … |
| 20260727120000_atomic_gig_booking.sql | no | 2/6 | views:gig_booking_reconciliation_candidates, policies:gigs/Gig managers can insert gigs, policies:gigs/Gig managers can update gigs … |
| 20260728090000_harden_battle_of_the_bands.sql | no | 2/3 | functions:botb_is_active_member |
| 20260728120002_reconcile_player_cash_finance.sql | no | 2/4 | functions:sync_company_balance_financial_account, triggers:trg_sync_company_balance_financial_account |
| 20260728140000_audit_gig_booking_runtime.sql | no | 1/3 | functions:active_band_performing_members, functions:check_gig_member_schedule_conflicts |
| 20260728160000_reconcile_live_gig_booking_runtime.sql | no | 3/5 | functions:active_band_performing_members, functions:check_gig_member_schedule_conflicts |
| 20260812120000_authoritative_gig_commerce.sql | no | 2/3 | policies:gig_commerce_settlements/Band members view gig commerce |
| 20260816102151_bd65db10-1c66-4d58-9543-1cd685f65c90.sql | yes | 4/6 | policies:band_members/Band leaders can manage members, policies:band_members/Members can update their own membership |
| 20260816114859_849408d9-287d-412d-9c7a-cc9991aa4582.sql | yes | 4/5 | policies:major_event_performances/Players insert own major event performances |
| 20260816125903_32c4cab2-a36b-427c-a3a4-74467010ffb6.sql | yes | 43/45 | policies:gig_crew_assignments/gig_crew_assignments_band_all, policies:gig_equipment_loadouts/gig_equipment_loadouts_band_all |
| 20260816131319_bcf70c40-ed18-4577-a3b7-671df8f45cac.sql | yes | 31/32 | policies:player_blocks/Players manage their own blocks |
| 20260820120000_release_finance_authority.sql | no | 5/9 | tables:release_currency_overcharge_repairs, functions:preview_release_currency_overcharge_repairs, functions:repair_release_currency_overcharge … |
| 20260820142500_skill_practice_lifecycle.sql | no | 4/5 | functions:check_profile_scheduling_conflict |
| 20260824104500_finance_a2_refunds_obligation_mortgage_repair.sql | no | 4/12 | functions:process_financial_obligation_payment_guarded, functions:process_financial_obligation_payment, functions:retry_my_financial_obligation_payment … |
| 20260825090000_support_band_marketplace_phase1.sql | no | 11/13 | policies:gig_support_slots/Headliners can create support slots, policies:gig_support_slots/Involved bands can update support slots |
| 20260825132200_festival_c7_social_safety_hardening.sql | no | 2/3 | functions:_festival_assert_moment_still_available |
| 20260831110123_capture_referral_at_signup.sql | yes | 1/2 | triggers:capture_referral_from_signup_trigger |
| 20260831160000_active_recording_sessions.sql | no | 1/2 | policies:active_recording_sessions/active recording sessions own select |
| 20260831220000_band_role_recruitment.sql | no | 1/5 | policies:band_vacancies/Open vacancies are viewable, policies:band_vacancies/Band leaders can create vacancies, policies:band_vacancies/Band leaders can update vacancies … |
| 20260903204623_harden_band_membership_flows.sql | yes | 14/17 | policies:band_members/Band managers can update members, policies:band_members/Band managers can remove members, policies:band_members/Members can leave bands |
| 20260903204839_refine_band_membership_policies.sql | yes | 4/5 | policies:band_members/Band member updates are authorised |
| 20260906081500_gig_setlist_snapshot_fallback.sql | no | 2/4 | triggers:trg_gig_setlists_sync_legacy, triggers:trg_gig_setlist_items_sync_legacy |
| 20260906200000_add_scandals_heat_lifecycle.sql | no | 8/9 | functions:private |
| 20260907060100_restore_achievement_reconciliation.sql | no | 15/16 | triggers:trg_reconcile_achievements_chart_entry |
| 20260907232000_merch_studio_overhaul.sql | no | 2/5 | policies:storage/Band members can upload merch artwork, policies:storage/Owners can update merch artwork, policies:storage/Owners can delete merch artwork |
| 20260910170500_apply_equipped_clothing_bonuses.sql | no | 1/6 | functions:apply_daily_clothing_bonus_to_wallet, functions:recording_session_clothing_bonus_pct, functions:apply_recording_clothing_bonus_to_song … |
| 20260916060000_add_profile_location_health.sql | no | 2/3 | functions:reset_player_character |
| 20260916073651_band_fame_fan_catalogue_random_events.sql | yes | 1/2 | functions:private |
| 20260918001000_add_totp_production_media.sql | no | 1/5 | policies:storage/TOTP admins can view media objects, policies:storage/TOTP admins can upload media objects, policies:storage/TOTP admins can update media objects … |
| 20260919130459_close_totp_phase2_render_worker_contract.sql | yes | 4/5 | policies:storage/TOTP admins can read broadcast masters |
| 20260920120000_create_busking_tables.sql | no | 1/3 | tables:busking_locations, tables:busking_modifiers |
| 20260921090000_create_production_sessions_tables.sql | no | 1/13 | tables:production_tracks, functions:set_current_timestamp_updated_at, policies:recording_sessions/Recording sessions are viewable by owners … |
| 20260922110002_split_player_skills_attributes.sql | no | 1/2 | triggers:if |
| 20260922120000_add_player_attributes_and_update_skills.sql | no | 5/7 | functions:reset_player_character, policies:player_attributes/Attributes are viewable by everyone |
| 20260923100000_create_player_attribute_catalog.sql | no | 3/8 | tables:attribute_catalog, functions:ensure_player_attributes, functions:reset_player_character … |
| 20260923110000_normalize_skills.sql | no | 2/16 | tables:skill_relationships, tables:profile_skill_progress, tables:profile_skill_unlocks … |
| 20260924100000_add_portsmouth_city_and_defaults.sql | no | 1/2 | functions:reset_player_character |
| 20261001090000_add_profile_character_slots.sql | no | 1/2 | functions:reset_player_character |
| 20261001130000_switch_default_city_to_london.sql | no | 1/2 | functions:reset_player_character |
| 20261004211805_luthiery_phase4_authoritative_crafting.sql | yes | 3/4 | tables:private |
| 20261004215150_luthiery_phase5_player_instrument_shops.sql | yes | 9/13 | functions:private, policies:luthiery_shops/Browse open Luthiery shops, policies:luthiery_shop_listings/Browse active Luthiery listings … |
| 20261004223323_complete_luthiery_phase4_xp_and_retry_authorization.sql | yes | 1/2 | functions:private |
| 20261004231831_lock_luthiery_phase6_gig_instrument_snapshots.sql | yes | 3/4 | functions:private |
| 20261006220521_finish_songwriting_collaboration_invites.sql | yes | 3/4 | functions:private |
| 20261007145500_songwriting_completion_polish.sql | no | 6/9 | functions:private, policies:songwriting_polish_sessions/Users view own songwriting polish sessions, triggers:trg_prepare_songwriting_completion |
| 20261008193206_idempotent_gig_consequences.sql | no | 6/11 | tables:gig_processing_claim_history, functions:prevent_gig_claim_history_mutation, policies:band_live_reputation/Band members can view live reputation … |
| 20261009134000_atomic_random_event_delivery.sql | no | 1/2 | functions:private |
| 20261013195000_public_profile_visibility_and_badges.sql | no | 1/4 | policies:player_profile_badges/Public badges follow character privacy, policies:player_profile_activity/Public activity follows character privacy, policies:player_career_milestones/Public milestones follow character privacy |
| 20261013210000_social_discovery_authoritative_viewer.sql | no | 2/3 | functions:resolve_authorized_social_viewer |
| 20261014113000_durable_deduped_game_notifications.sql | no | 3/6 | functions:persist_game_event_notification, functions:persist_chart_notification_from_event, functions:persist_game_event_on_change |
| 20261016103000_halloween_2026_gig_rewards.sql | no | 8/9 | triggers:trg_apply_clothing_bonus_to_gig_outcome |
| 20261020100000_zero_skill_attribute_defaults.sql | no | 1/2 | functions:reset_player_character |
| 20261022103000_add_city_night_clubs.sql | no | 3/4 | policies:city_night_clubs/Privileged roles manage night clubs |
| 20261030130000_create_xp_tables.sql | no | 3/6 | tables:xp_ledger, tables:player_weekly_activity, tables:attribute_spend |
| 20261031120001_replace_daily_conversion_with_weekly_bonus.sql | no | 1/4 | functions:process_weekly_experience_bonus, policies:experience_ledger/Experience ledger entries are viewable by owners, policies:experience_ledger/System can insert experience ledger entries |
| 20261101100000_create_friendships_table.sql | no | 2/10 | views:pending_friendships, views:accepted_friendships, functions:set_friendship_responded_at … |
| 20261202090000_create_universities_table.sql | no | 2/4 | policies:universities/Service roles can manage universities, triggers:set_universities_updated_at |
| 20261205100000_create_skill_books_tables.sql | no | 2/8 | policies:skill_books/Skill books are viewable by everyone, policies:skill_books/Privileged roles manage skill books, policies:player_skill_books/Players can view their skill books … |
| 20270101090000_create_public_universities.sql | no | 2/4 | policies:universities/Service roles can manage universities, triggers:set_universities_updated_at |
| 20270102090000_create_skill_books_tables.sql | no | 2/7 | policies:skill_books/Skill books are viewable by everyone, policies:skill_books/Service roles can manage skill books, policies:player_skill_books/Players can view their skill books … |
| 20270402090000_create_public_universities_table.sql | no | 2/4 | policies:universities/Service roles can manage universities, triggers:set_universities_updated_at |
| 20270415120000_update_player_attribute_defaults.sql | no | 1/2 | functions:reset_player_character |
| 20270418100000_add_venue_support_structures.sql | no | 2/6 | policies:venue_relationships/Users view their venue relationships, policies:venue_relationships/Users manage their venue relationships, policies:venue_bookings/Users view their venue bookings … |
| 20270420120000_create_festival_tables.sql | no | 3/8 | tables:festival_lineups, policies:festivals/Service roles update festivals, policies:festival_lineups/Festival lineups are viewable by everyone … |
| 20270425130000_add_universities_and_skill_books_updates.sql | no | 4/6 | functions:reset_player_character, policies:skill_books/Skill books are viewable by everyone |
| 20270431160000_enforce_player_skills_minimum.sql | no | 1/2 | functions:reset_player_character |
| 20270601120000_add_daily_xp_allocation.sql | no | 2/4 | functions:progression_claim_daily_xp, functions:progression_spend_attribute_xp |
| 20270602100001_create_education_youtube_tables.sql | no | 1/8 | tables:education_youtube_lessons, policies:education_youtube_lessons/Education lessons are viewable by everyone, policies:education_youtube_lessons/Privileged roles manage education lessons … |
| 20270606100000_add_profile_activity_statuses.sql | no | 1/7 | functions:set_profile_activity_status_updated_at, functions:sync_profile_activity_status_ends_at, policies:profile_activity_statuses/Profile activity statuses are viewable by everyone … |
| 20270607100000_create_songwriting_tables.sql | no | 2/12 | functions:set_current_timestamp_updated_at, policies:songwriting_projects/Songwriting projects are viewable by owners, policies:songwriting_projects/Songwriting projects can be inserted by owners … |
| 20270612120000_handle_new_user_city_fallback.sql | no | 1/3 | functions:get_default_city_id, functions:reset_player_character |
| 20270617103000_create_world_environment_tables.sql | no | 2/20 | tables:city_metadata, tables:studios, tables:weather … |
| 20270630153000_expand_songwriting_and_activity_schema.sql | no | 1/7 | functions:set_profile_activity_status_updated_at, functions:sync_profile_activity_status_ends_at, policies:profile_activity_statuses/Profile activity statuses are viewable by everyone … |
| 20270631100000_enhance_songwriting_dimensions.sql | no | 1/10 | tables:song_genre_catalog, tables:song_purposes, tables:song_writing_modes … |
| 20270631123000_create_admin_cron_monitor_tables.sql | no | 2/7 | tables:admin_cron_jobs, policies:admin_cron_jobs/Service role manages admin cron jobs, policies:admin_cron_jobs/Admins can view cron jobs … |
| 20291201090000_create_sponsorship_tables.sql | no | 2/9 | tables:brands, tables:sponsorship_history, functions:enforce_character_contract_limit … |
| 20291203090000_player_social_safety.sql | no | 11/21 | functions:get_social_block_state, functions:can_send_friend_request, policies:player_blocks/Players can read their own active blocks … |
| 20291211090000_festival_admin_management.sql | no | 15/16 | policies:festival_admin_audit_events/festival_admin_audit_admin_read |
| 20291212090000_complete_festival_edition_operations.sql | no | 18/52 | tables:festival_staff_candidates_persistent, tables:festival_edition_insurance_quotes, tables:festival_edition_budget_changes … |
| 20291214080000_repair_and_expose_festival_features.sql | no | 4/6 | functions:resolve_festival_stage_edition, functions:festival_settlement_report |
| 20291215090000_festival_phase2a_visual_scheduling.sql | no | 9/18 | tables:festival_schedule_revisions, tables:festival_schedule_stage_operating_hours, tables:festival_schedule_items … |
| 20291217110000_apply_festival_operations_hardening.sql | no | 2/5 | functions:can_manage_festival_edition_internal, functions:festival_safe_jsonb_nonnegative_integer, functions:festival_edition_operations_summary_internal |
| 20291217151000_complete_festival_artist_workflows.sql | no | 18/19 | functions:_festival_artist_authorised |
| 20291217160000_festival_staffing_and_suppliers.sql | no | 15/31 | tables:festival_supplier_allocations, functions:publish_festival_staff_vacancy, functions:apply_for_festival_staff_vacancy … |
| 20291217180000_festival_timetable_and_readiness.sql | no | 1/42 | tables:festival_timetable_plans, tables:festival_timetable_days, tables:festival_stage_operating_windows … |
| 20291217190000_festival_launch_and_ticket_sales.sql | no | 22/46 | tables:festival_launch_snapshots, tables:festival_public_editions, tables:festival_public_stages … |
| 20291217200000_live_festival_runtime_foundation.sql | no | 1/55 | tables:festival_runtime_sessions, tables:festival_runtime_days, tables:festival_runtime_stages … |
| 20291217220000_festival_financial_settlement.sql | no | 2/25 | tables:festival_financial_settlements, tables:festival_settlement_snapshots, tables:festival_settlement_payments … |
| 20291217230000_festival_historical_legacy.sql | no | 14/27 | tables:festival_legacy_generation_jobs, tables:festival_reputation_changes, tables:festival_reputation_receipts … |
| 20291218233000_canonical_festival_upgrades.sql | no | 15/28 | tables:festival_upgrade_prerequisites, tables:festival_upgrade_effect_snapshots, tables:festival_upgrade_upkeep_obligations … |
| 20291218235000_repair_gig_performer_insert_trigger.sql | no | 1/2 | functions:validate_gig_performer |
| 20291218240000_canonical_character_banking_and_band_funding.sql | no | 7/9 | views:wallet_and_treasury_projection_integrity_issues, functions:_move_financial_account_money |
| 20291218241000_repair_character_banking_and_band_funding.sql | no | 2/5 | functions:ensure_band_finance_defaults, functions:seed_band_finance_defaults_after_insert, triggers:trg_seed_band_finance_defaults |
| 20291218242000_canonical_banking_dashboard_and_savings_goals.sql | no | 1/5 | functions:create_my_savings_goal, functions:get_my_savings_goal_funding_sources, functions:preview_my_savings_goal_funding … |
| 20291218243200_reconcile_20250916150000_bundle.sql | no | 1/16 | tables:record_labels, tables:streaming_campaigns, functions:update_record_labels_updated_at … |
| 20291218243300_reconcile_20250916153000_bundle.sql | no | 10/29 | tables:competitions, tables:competition_participants, tables:player_rankings … |
| 20291218243400_reconcile_20250917090000_bundle.sql | no | 16/58 | tables:label_members, tables:label_reputation_events, tables:promotion_campaigns … |
| 20291218243600_reconcile_stage_equipment_policies.sql | no | 1/5 | policies:band_vehicles/Band members can manage their vehicles, policies:band_equipment_maintenance_logs/Band members can view equipment logs, policies:band_equipment_maintenance_logs/Band members can manage equipment logs … |
| 20291218243700_authoritative_festival_edition_runtime.sql | no | 9/14 | tables:festival_runtime_ticks, tables:festival_runtime_incident_catalogue, tables:festival_edition_runtime_incidents … |
| 20291218243800_authoritative_festival_edition_settlement.sql | no | 9/23 | tables:festival_edition_settlement_lines, tables:festival_edition_settlement_requests, tables:festival_edition_posting_batches … |
| 20291218243900_complete_festival_settlement_finalisation.sql | no | 9/14 | tables:festival_edition_settlement_effects, tables:festival_edition_tax_lines, functions:_complete_festival_settlement_request … |
| 20291218244200_operational_festival_effect_worker.sql | no | 2/9 | functions:_festival_outcome_application_guard, functions:claim_next_festival_settlement_effect, functions:_festival_effect_completion_guard … |
| 20291218244300_canonical_festival_effect_authorities.sql | no | 3/26 | tables:festival_effect_authority_results, functions:_festival_effect_authority_context, functions:_festival_record_authority_result … |
| 20291218244900_festival_annual_edition_realign.sql | no | 8/12 | tables:festival_edition_migration_review, views:festival_edition_migration_summary, policies:festival_edition_audit/festival_edition_audit_owner_read … |
| 20291218245100_festival_upgrade_catalogue_v2_realign.sql | no | 5/6 | functions:_festival_upgrade_purchase_window |
| 20291218245200_festival_upgrade_v2_hardening.sql | no | 3/5 | views:festival_upgrade_migration_summary, functions:_festival_upgrade_eligibility |
| 20291218245500_festival_edition_internal_projections.sql | no | 13/14 | functions:_festival_projection_authorized |
| 20291218245600_festival_licence_and_manager_authority.sql | no | 9/16 | tables:festival_licence_requests, functions:_festival_licence_tier_json, functions:_festival_licence_requirements … |
| 20291218245800_complete_simplified_festival_lineup.sql | no | 6/7 | functions:_festival_artist_committed_minor |
| 20291218245800_release_finance_consistency.sql | no | 4/5 | functions:audit_release_currency_overcharges |
| 20291218245910_harden_simplified_festival_ticket_readiness.sql | no | 1/3 | functions:_festival_capture_ticket_owner_confirmation, triggers:festival_capture_ticket_owner_confirmation |
| 20291218245920_normalize_simplified_festival_running_order.sql | no | 1/2 | functions:_normalize_simplified_festival_running_order |
| 20291218250000_city_governance_authority.sql | no | 2/13 | functions:city_governance_skill_value, functions:complete_city_project, functions:process_due_city_projects … |
| 20291219000000_close_canonical_festival_performance_sessions.sql | no | 1/2 | functions:get_festival_performance_session |
| 20291219010000_festival_performance_readiness_authority.sql | no | 3/8 | tables:festival_performance_requirements, functions:festival_performance_countdown, functions:evaluate_festival_performance_readiness … |
| 20291219070000_festival_b7_collaboration_voting_closure.sql | no | 2/36 | tables:festival_performance_collaborations, tables:festival_performance_collaboration_events, tables:festival_rivalry_objectives … |
| 20291219080000_festival_c1_wristband_inventory.sql | no | 1/3 | functions:_festival_issue_wristband_from_attendance, triggers:festival_attendance_issue_wristband_on_ticket |
| 20291219100000_festival_c4_schedule_activity_authority.sql | no | 3/14 | functions:_festival_band_active_profiles, functions:_festival_activity_allowed_for_edition, functions:_festival_profile_commitment_conflict … |
| 20291219110000_festival_c5_day_planner_foundation.sql | no | 5/6 | functions:_festival_attendee_legacy_edition |
| 20300106170000_repair_band_recruitment_capacity_applications_expiry.sql | no | 5/6 | functions:accept_band_offer |
| 20300106180000_correct_recruitment_approvals_and_departures.sql | no | 1/3 | functions:release_departed_recruitment_slot, triggers:band_member_recruitment_slot_departure |
