# Recent-script reconciliation (created 17 Sep – 17 Oct 2026)

Creation date = first commit adding the file. 432 scripts were added in the window; 294 applied, 71 change-only, 38 missing, 29 partial. Many files dated 2026-10-08 are an older batch re-added in one commit, not new work.

## 2029/2030-named scripts by real creation month

| Created | Count |
|---|---|
| 2025-10 | 2 |
| 2025-11 | 19 |
| 2026-03 | 1 |
| 2026-07 | 115 |
| 2026-08 | 64 |
| 2026-09 | 29 |
| 2026-10 | 12 |

## Applied 2026-10-17 (needed by game screens; repo copies had typos so never ran)

- player_merch_wearables, get_stage_merch_wearables, get_gig_merch_crowd_signal (fixed `$;` typo and band_members.status → member_status)
- skill_tier_access_bulk, skip_and_complete_songwriting_project
- create_recovery_character_atomic (fixed broken regex and duplicated tail), finalize_character_retirement
- book_gig_with_personal_funding

## Recent gaps still open

| Created | Status | Script | Present | Missing objects |
|---|---|---|---|---|
| 2026-10-08 | partial | 20260316093001_fix_promotional_campaigns_rls.sql | 2/3 | policies:promotional_campaigns/Users can create campaigns for their releases |
| 2026-10-08 | partial | 20260710120001_beta_admin_support_tools.sql | 1/8 | tables:admin_action_audit,functions:admin_search_players,functions:admin_get_player_support_summary,functions:admin_adjust_player_cash,functions:admin_cancel_pr |
| 2026-10-08 | partial | 20260710120002_complete_company_recruitment_lifecycle.sql | 9/15 | functions:calculate_company_job_suitability,policies:company_job_applications/Applications are created through recruitment RPC,policies:company_job_applications |
| 2026-10-08 | partial | 20260712120001_gig_audience_participation.sql | 6/31 | tables:gig_audience_polls,tables:gig_audience_poll_votes,tables:gig_audience_ratings,tables:gig_audience_reward_records,functions:submit_gig_audience_poll_vote, |
| 2026-10-08 | partial | 20260712120004_songwriting_outcome_calculator.sql | 2/7 | functions:songwriting_skill_level,functions:songwriting_attribute_value,functions:songwriting_genre_slug,functions:songwriting_seeded_variance,functions:complet |
| 2026-10-08 | partial | 20260712120005_tour_operations_multi_gig_management.sql | 9/27 | policies:tour_operation_templates/Band members view tour operation templates,policies:tour_operation_templates/Band leaders manage tour operation templates,poli |
| 2026-10-08 | missing | 20260712120006_wellness_accommodation_travel_recovery.sql | 0/8 | tables:accommodation_recovery_profiles,tables:transport_wellness_profiles,tables:wellness_recovery_events,tables:tour_load_summaries,policies:accommodation_reco |
| 2026-10-08 | missing | 20260712120007_wellness_professionals.sql | 0/7 | tables:wellness_provider_profiles,tables:wellness_provider_listings,tables:wellness_appointments,tables:wellness_support_contracts,tables:wellness_care_plans,ta |
| 2026-10-08 | missing | 20260712143001_wellness_time_away_longevity.sql | 0/18 | tables:time_away_type_config,tables:time_away_bookings,tables:time_away_itinerary_items,tables:time_away_companion_invitations,tables:time_away_band_approvals,t |
| 2026-10-08 | missing | 20260713090001_create_balance_management_registry.sql | 0/14 | tables:balance_versions,tables:balance_validation_results,tables:balance_simulation_results,tables:balance_rollouts,tables:balance_audit_log,functions:prevent_a |
| 2026-10-08 | missing | 20260713090002_player_progression_analytics.sql | 0/12 | tables:player_progression_snapshots,tables:player_analytics_recommendation_states,tables:player_analytics_exports,tables:player_analytics_telemetry,functions:ge |
| 2026-10-08 | missing | 20260713120001_progression_achievements_canonical.sql | 0/21 | tables:achievement_criteria,tables:achievement_event_mappings,tables:achievement_rewards,tables:achievement_progress,tables:profile_titles,tables:profile_badges |
| 2026-10-08 | partial | 20260713130002_player_discovery_search_matchmaking.sql | 7/10 | tables:player_discovery_profiles,functions:player_discovery_match_score,policies:player_saved_searches/Players manage their saved discovery searches |
| 2026-10-08 | partial | 20260713193001_private_messaging_conversations.sql | 7/14 | tables:message_attachments,functions:direct_pair_key,functions:is_conversation_participant,policies:conversations/Participants read conversations,policies:conve |
| 2026-10-08 | missing | 20260717120001_finance_phase2_player_band_management.sql | 0/18 | tables:band_finance_policies,tables:band_finance_role_permissions,tables:band_member_contributions,tables:band_withdrawal_requests,tables:band_reimbursement_req |
| 2026-10-08 | partial | 20260717153001_harden_festival_creation_phase1_forward.sql | 6/7 | functions:internal_create_festival_edition_setup |
| 2026-10-08 | partial | 20260728120002_reconcile_player_cash_finance.sql | 2/4 | functions:sync_company_balance_financial_account,triggers:trg_sync_company_balance_financial_account |
| 2026-10-08 | missing | 20260728130001_replace_legacy_gig_travel_trigger.sql | 0/2 | functions:check_gig_member_schedule_conflicts,triggers:check_gig_member_schedule_conflicts |
| 2026-10-08 | missing | 20260910170501_band_clothing_performance_bonus.sql | 0/1 | functions:get_band_equipped_clothing_performance_bonus |
| 2026-09-18 | partial | 20260918001000_add_totp_production_media.sql | 1/5 | policies:storage/TOTP admins can view media objects,policies:storage/TOTP admins can upload media objects,policies:storage/TOTP admins can update media objects, |
| 2026-09-19 | partial | 20260919130459_close_totp_phase2_render_worker_contract.sql | 4/5 | policies:storage/TOTP admins can read broadcast masters |
| 2026-09-22 | missing | 20260922105500_add_vip_concierge_totp_travel.sql | 0/2 | functions:book_vip_totp_concierge_travel,functions:auto_prepare_totp_travel |
| 2026-10-08 | partial | 20260922110002_split_player_skills_attributes.sql | 1/2 | triggers:if |
| 2026-09-26 | missing | 20260926231000_festival_atomic_stage_reorder.sql | 0/1 | functions:festival_schedule_reorder_stage |
| 2026-09-28 | missing | 20260928160000_backfill_canonical_sponsorship_brand_logos.sql | 0/1 | functions:festival_brand_monogram_logo |
| 2026-09-29 | missing | 20260929120000_reconcile_stale_gig_post_processing.sql | 0/1 | functions:reconcile_stale_gig_post_processing |
| 2026-10-02 | missing | 20261002083000_complete_higher_tier_learning_access.sql | 0/1 | views:skill_learning_source_gaps |
| 2026-10-04 | partial | 20261004211805_luthiery_phase4_authoritative_crafting.sql | 3/4 | tables:private |
| 2026-10-04 | partial | 20261004215150_luthiery_phase5_player_instrument_shops.sql | 9/13 | functions:private,policies:luthiery_shops/Browse open Luthiery shops,policies:luthiery_shop_listings/Browse active Luthiery listings,policies:luthiery_shop_sale |
| 2026-10-04 | missing | 20261004215337_harden_luthiery_phase5_browsing.sql | 0/2 | policies:luthiery_shops/Browse open Luthiery shops,policies:luthiery_shop_listings/Browse active Luthiery listings |
| 2026-10-04 | missing | 20261004215752_allow_authoritative_luthiery_shop_transfer.sql | 0/1 | functions:private |
| 2026-10-04 | missing | 20261004220712_hide_closed_luthiery_shop_listings.sql | 0/1 | policies:luthiery_shop_listings/Browse active Luthiery listings |
| 2026-10-04 | partial | 20261004223323_complete_luthiery_phase4_xp_and_retry_authorization.sql | 1/2 | functions:private |
| 2026-10-05 | partial | 20261004231831_lock_luthiery_phase6_gig_instrument_snapshots.sql | 3/4 | functions:private |
| 2026-10-06 | missing | 20261006082500_luthiery_career_learning_routes.sql | 0/1 | views:luthiery_learning_source_gaps |
| 2026-10-06 | partial | 20261006220521_finish_songwriting_collaboration_invites.sql | 3/4 | functions:private |
| 2026-10-07 | partial | 20261007145500_songwriting_completion_polish.sql | 6/9 | functions:private,policies:songwriting_polish_sessions/Users view own songwriting polish sessions,triggers:trg_prepare_songwriting_completion |
| 2026-10-08 | partial | 20261008193206_idempotent_gig_consequences.sql | 6/11 | tables:gig_processing_claim_history,functions:prevent_gig_claim_history_mutation,policies:band_live_reputation/Band members can view live reputation,policies:gi |
| 2026-10-09 | partial | 20261009134000_atomic_random_event_delivery.sql | 1/2 | functions:private |
| 2026-10-13 | missing | 20261013184000_achievement_event_reward_integrity.sql | 0/5 | tables:achievement_processed_events,tables:achievement_reward_settlements,functions:achievement_event_criteria_met,functions:complete_achievement_for_event,func |
| 2026-10-13 | partial | 20261013195000_public_profile_visibility_and_badges.sql | 1/4 | policies:player_profile_badges/Public badges follow character privacy,policies:player_profile_activity/Public activity follows character privacy,policies:player |
| 2026-10-13 | partial | 20261013210000_social_discovery_authoritative_viewer.sql | 2/3 | functions:resolve_authorized_social_viewer |
| 2026-10-14 | partial | 20261014113000_durable_deduped_game_notifications.sql | 3/6 | functions:persist_game_event_notification,functions:persist_chart_notification_from_event,functions:persist_game_event_on_change |
| 2026-10-16 | partial | 20261016103000_halloween_2026_gig_rewards.sql | 8/9 | triggers:trg_apply_clothing_bonus_to_gig_outcome |
| 2026-10-08 | partial | 20261031120001_replace_daily_conversion_with_weekly_bonus.sql | 1/4 | functions:process_weekly_experience_bonus,policies:experience_ledger/Experience ledger entries are viewable by owners,policies:experience_ledger/System can inse |
| 2026-10-08 | partial | 20270602100001_create_education_youtube_tables.sql | 1/8 | tables:education_youtube_lessons,policies:education_youtube_lessons/Education lessons are viewable by everyone,policies:education_youtube_lessons/Privileged rol |
| 2026-09-28 | missing | 20291220090000_link_festival_sponsors_to_canonical_brands.sql | 0/1 | views:festival_eligible_sponsorship_brands |
| 2026-09-28 | missing | 20291220092000_enforce_festival_sponsor_slots.sql | 0/2 | functions:festival_enforce_sponsor_slots,triggers:festival_enforce_sponsor_slots_trigger |
| 2026-09-28 | missing | 20291220093000_festival_sponsor_slot_readiness.sql | 0/1 | views:festival_sponsor_slot_readiness |
| 2026-09-28 | missing | 20291220095000_require_festival_main_sponsor_at_launch.sql | 0/2 | functions:festival_require_main_sponsor_at_launch,triggers:festival_require_main_sponsor_at_launch_trigger |
| 2026-09-28 | missing | 20291220096000_add_festival_canonical_brand_prospect.sql | 0/1 | functions:add_festival_canonical_brand_prospect |
| 2026-09-28 | missing | 20291220097000_preserve_automatic_festival_sponsor_launch.sql | 0/1 | functions:festival_require_main_sponsor_at_launch |
| 2026-09-26 | missing | 20291220104300_atomic_simplified_artist_payouts.sql | 0/2 | tables:festival_simplified_artist_payouts,functions:_pay_simplified_festival_artist_bookings |
| 2026-09-26 | missing | 20291220104400_audited_premature_festival_rerun.sql | 0/2 | tables:festival_simplified_rerun_archives,functions:prepare_premature_simplified_festival_rerun |
| 2026-10-13 | partial | 20300106170000_repair_band_recruitment_capacity_applications_expiry.sql | 5/6 | functions:accept_band_offer |
| 2026-10-13 | partial | 20300106180000_correct_recruitment_approvals_and_departures.sql | 1/3 | functions:release_departed_recruitment_slot,triggers:band_member_recruitment_slot_departure |
| 2026-10-14 | missing | 20300106200000_secure_atomic_weekly_band_payroll.sql | 0/2 | tables:band_weekly_payroll_settlements,functions:process_weekly_band_payroll |
| 2026-10-14 | missing | 20300106201000_controlled_random_event_backlog_reconciliation.sql | 0/2 | tables:random_event_reconciliation_audit,functions:reconcile_random_event_backlog |

## 2029/2030-named scripts with real creation dates

| Created | Script |
|---|---|
| 2025-10-08 | 20290601120000_add_avatar_and_location_to_profiles.sql |
| 2025-10-08 | 20290602110000_ensure_auto_clock_in_column.sql |
| 2025-11-13 | 20290602120001_create_personal_loadouts.sql |
| 2025-11-13 | 20290602130000_expand_equipment_categories_and_currency.sql |
| 2025-11-13 | 20290602130000_extend_personal_loadouts_with_slots.sql |
| 2025-11-13 | 20290603100000_create_music_video_release_tables.sql |
| 2025-11-13 | 20290603110000_create_process_radio_submission_function.sql |
| 2025-11-13 | 20290620120000_enhance_music_video_configs.sql |
| 2025-11-13 | 20290701090000_enhance_equipment_purchase_and_gear_pool.sql |
| 2025-11-14 | 20290702010000_create_community_feed_tables.sql |
| 2025-11-14 | 20290702010000_extend_label_financials.sql |
| 2025-11-14 | 20290702100000_create_community_mentorship_tables.sql |
| 2025-11-14 | 20290702100000_create_story_narrative_tables.sql |
| 2025-11-14 | 20290702120000_create_band_membership_management.sql |
| 2025-11-14 | 20290705090000_create_side_hustle_progress_tables.sql |
| 2025-11-14 | 20290705120000_create_lifestyle_properties.sql |
| 2025-11-14 | 20291012090000_create_casting_calls_workflow.sql |
| 2025-11-16 | 20290702095000_create_community_charity_tables.sql |
| 2025-11-16 | 20290715120000_create_audio_generation_pipeline.sql |
| 2025-11-19 | 20291115090000_create_eurovision_tables.sql |
| 2025-11-25 | 20291201090000_create_sponsorship_tables.sql |
| 2026-03-17 | 20290602130000_seed_more_achievements_and_unlock_xp.sql |
| 2026-07-10 | 20290711020000_contribution_source_adapters.sql |
| 2026-07-10 | 20290711030000_rehearsal_attendance_gig_lineups.sql |
| 2026-07-10 | 20291202090000_beta_rls_hardening.sql |
| 2026-07-13 | 20291203090000_player_social_safety.sql |
| 2026-07-16 | 20291204090000_create_festival_editions.sql |
| 2026-07-16 | 20291205090000_harden_festival_editions.sql |
| 2026-07-16 | 20291206090000_festival_booking_contracts.sql |
| 2026-07-16 | 20291207090000_harden_festival_booking_contracts.sql |
| 2026-07-16 | 20291208090000_complete_festival_booking_workspaces.sql |
| 2026-07-16 | 20291209090000_festival_performance_sessions.sql |
| 2026-07-16 | 20291210090000_festival_audience_and_outcomes.sql |
| 2026-07-16 | 20291211090000_festival_admin_management.sql |
| 2026-07-16 | 20291212090000_complete_festival_edition_operations.sql |
| 2026-07-16 | 20291213080000_stabilise_festival_domain.sql |
| 2026-07-16 | 20291213090000_festival_effects_and_settlement.sql |
| 2026-07-16 | 20291214080000_repair_and_expose_festival_features.sql |
| 2026-07-16 | 20291216080000_repair_festival_owner_bootstrap.sql |
| 2026-07-17 | 20291215090000_festival_phase2a_visual_scheduling.sql |
| 2026-07-20 | 20291217080000_fix_deployed_band_treasury_dashboard.sql |
| 2026-07-20 | 20291217090000_finance_band_treasury_finalisation.sql |
| 2026-07-20 | 20291217100000_finalise_festival_operations_summary.sql |
| 2026-07-20 | 20291217110000_apply_festival_operations_hardening.sql |
| 2026-07-20 | 20291217120000_repair_admin_festival_catalogue.sql |
| 2026-07-20 | 20291217121000_repair_admin_festival_catalogue_warning_arrays.sql |
| 2026-07-26 | 20291217122000_festival_configuration_wizard.sql |
| 2026-07-26 | 20291217130000_festival_site_and_stage_planning.sql |
| 2026-07-26 | 20291217140000_festival_ticketing_and_capacity_planning.sql |
| 2026-07-26 | 20291217150000_festival_artist_applications_and_bookings.sql |
| 2026-07-26 | 20291217151000_complete_festival_artist_workflows.sql |
| 2026-07-26 | 20291217160000_festival_staffing_and_suppliers.sql |
| 2026-07-26 | 20291217161000_complete_festival_staffing_supplier_workflows.sql |
| 2026-07-26 | 20291217170000_festival_sponsorship_and_partnerships.sql |
| 2026-07-26 | 20291217171000_complete_festival_sponsorship_workflows.sql |
| 2026-07-26 | 20291217180000_festival_timetable_and_readiness.sql |
| 2026-07-26 | 20291217190000_festival_launch_and_ticket_sales.sql |
| 2026-07-26 | 20291217200000_live_festival_runtime_foundation.sql |
| 2026-07-26 | 20291217210000_festival_crowds_incidents_and_operations.sql |
| 2026-07-26 | 20291217220000_festival_financial_settlement.sql |
| 2026-07-26 | 20291217230000_festival_historical_legacy.sql |
| 2026-07-26 | 20291218000000_complete_festival_runtime_worker_boundary.sql |
| 2026-07-26 | 20291218010000_festival_cross_phase_contracts.sql |
| 2026-07-26 | 20291218020000_festival_runtime_v2_hardening.sql |
| 2026-07-26 | 20291218030000_festival_settlement_v2.sql |
| 2026-07-26 | 20291218040000_execute_festival_settlement_v2.sql |
| 2026-07-26 | 20291218050000_native_festival_settlement_v2.sql |
| 2026-07-26 | 20291218060000_auditable_festival_settlement_v2.sql |
| 2026-07-26 | 20291218070000_complete_festival_settlement_v2.sql |
| 2026-07-26 | 20291218080000_repair_festival_settlement_execution.sql |
| 2026-07-26 | 20291218090000_native_festival_settlement_execution.sql |
| 2026-07-26 | 20291218100000_festival_settlement_v3_forward_corrections.sql |
| 2026-07-26 | 20291218110000_finish_festival_settlement_v3.sql |
| 2026-07-26 | 20291218120000_complete_festival_settlement_obligations.sql |
| 2026-07-26 | 20291218130000_native_festival_obligations_and_finalisation.sql |
| 2026-07-27 | 20291218140000_festival_native_preparation_finalisation_repair.sql |
| 2026-07-27 | 20291218150000_festival_settlement_v6_integrity_hardening.sql |
| 2026-07-27 | 20291218160000_festival_settlement_canonical_evidence.sql |
| 2026-07-27 | 20291218170000_festival_settlement_full_reconciliation.sql |
| 2026-07-27 | 20291218180000_festival_lifecycle_recovery.sql |
| 2026-07-27 | 20291218190000_operationalise_festival_lifecycle_recovery.sql |
| 2026-07-27 | 20291218200000_close_festival_recovery_authority_gaps.sql |
| 2026-07-27 | 20291218210000_make_festival_operation_claims_executable.sql |
| 2026-07-28 | 20291218220000_fence_festival_lifecycle_workers.sql |
| 2026-07-28 | 20291218230000_canonical_festival_route_resolvers.sql |
| 2026-07-28 | 20291218233000_canonical_festival_upgrades.sql |
| 2026-07-28 | 20291218234000_reconcile_active_profile_banking.sql |
| 2026-07-28 | 20291218235000_repair_gig_performer_insert_trigger.sql |
| 2026-07-28 | 20291218240000_canonical_character_banking_and_band_funding.sql |
| 2026-07-29 | 20291218241000_repair_character_banking_and_band_funding.sql |
| 2026-07-29 | 20291218242000_canonical_banking_dashboard_and_savings_goals.sql |
| 2026-07-29 | 20291218242100_harden_canonical_savings_goal_compatibility.sql |
| 2026-07-29 | 20291218242300_harden_personal_banking_transfers.sql |
| 2026-07-29 | 20291218242310_harden_financial_transfer_idempotency.sql |
| 2026-07-29 | 20291218242400_canonical_finance_command_center.sql |
| 2026-07-29 | 20291218242500_add_charity_donation_transaction_category.sql |
| 2026-07-29 | 20291218242550_repair_financial_move_currency_entries.sql |
| 2026-07-29 | 20291218242600_atomic_charity_donations.sql |
| 2026-07-29 | 20291218242700_complete_band_member_lock_foreign_key.sql |
| 2026-07-29 | 20291218242800_standardise_profile_activity_end_times.sql |
| 2026-07-29 | 20291218242900_complete_tour_venue_cost_fields.sql |
| 2026-07-29 | 20291218243000_reconcile_auth_signup_trigger.sql |
| 2026-07-29 | 20291218243100_neutralise_insecure_default_admin.sql |
| 2026-07-29 | 20291218243200_reconcile_20250916150000_bundle.sql |
| 2026-07-29 | 20291218243300_reconcile_20250916153000_bundle.sql |
| 2026-07-29 | 20291218243400_reconcile_20250917090000_bundle.sql |
| 2026-07-29 | 20291218243410_fix_label_release_status_trigger.sql |
| 2026-07-29 | 20291218243420_repair_song_collaborator_constraints.sql |
| 2026-07-29 | 20291218243430_reconcile_social_skill_compatibility.sql |
| 2026-07-29 | 20291218243440_reconcile_player_skills_compatibility.sql |
| 2026-07-29 | 20291218243450_reconcile_university_class_hours.sql |
| 2026-07-29 | 20291218243500_reconcile_jam_activity_compatibility.sql |
| 2026-07-29 | 20291218243510_reconcile_activity_status_song_link.sql |
| 2026-07-29 | 20291218243520_reconcile_band_invitation_schema.sql |
| 2026-07-29 | 20291218243530_reconcile_song_profile_ownership.sql |
| 2026-07-29 | 20291218243540_reconcile_completed_songwriting_projects.sql |
| 2026-07-29 | 20291218243550_reconcile_streaming_analytics_ownership.sql |
| 2026-07-29 | 20291218243600_reconcile_stage_equipment_policies.sql |
| 2026-07-29 | 20291218243610_reconcile_label_schema_compatibility.sql |
| 2026-07-29 | 20291218243620_reconcile_setlist_performance_items.sql |
| 2026-07-29 | 20291218243630_reconcile_music_video_ownership.sql |
| 2026-07-29 | 20291218243640_reconcile_setlist_performance_policies.sql |
| 2026-07-29 | 20291218243650_reconcile_released_songs_and_security_policies.sql |
| 2026-07-30 | 20291217220000_authoritative_festival_edition_scheduling.sql |
| 2026-07-30 | 20291218243700_authoritative_festival_edition_runtime.sql |
| 2026-07-30 | 20291218243800_authoritative_festival_edition_settlement.sql |
| 2026-07-30 | 20291218243900_complete_festival_settlement_finalisation.sql |
| 2026-07-30 | 20291218244000_festival_settlement_effect_lifecycle.sql |
| 2026-07-31 | 20291218244100_festival_effect_settlement_states.sql |
| 2026-07-31 | 20291218244200_operational_festival_effect_worker.sql |
| 2026-07-31 | 20291218244300_canonical_festival_effect_authorities.sql |
| 2026-07-31 | 20291218244400_fail_closed_festival_canonical_effects.sql |
| 2026-07-31 | 20291218244401_require_complete_festival_canonical_evidence.sql |
| 2026-07-31 | 20291218244500_shared_live_performance_progression.sql |
| 2026-07-31 | 20291218244600_repair_live_performance_progression.sql |
| 2026-07-31 | 20291218244700_certify_live_performance_progression.sql |
| 2026-07-31 | 20291218244800_certify_festival_core_progression_authorities.sql |
| 2026-08-02 | 20291218244900_festival_annual_edition_realign.sql |
| 2026-08-02 | 20291218245000_festival_setup_catalogue_contract.sql |
| 2026-08-02 | 20291218245100_festival_upgrade_catalogue_v2_realign.sql |
| 2026-08-02 | 20291218245200_festival_upgrade_v2_hardening.sql |
| 2026-08-03 | 20291218245000_festival_owner_edition_directory.sql |
| 2026-08-03 | 20291218245300_festival_simplified_annual_plan.sql |
| 2026-08-03 | 20291218245400_festival_simplified_annual_plan_security.sql |
| 2026-08-03 | 20291218245500_festival_edition_internal_projections.sql |
| 2026-08-03 | 20291218245600_festival_licence_and_manager_authority.sql |
| 2026-08-04 | 20291218245700_reconcile_festival_setup_authority.sql |
| 2026-08-20 | 20291218245800_release_finance_consistency.sql |
| 2026-08-22 | 20291218245800_complete_simplified_festival_lineup.sql |
| 2026-08-22 | 20291218245900_finish_simplified_festival_runtime.sql |
| 2026-08-22 | 20291218245910_harden_simplified_festival_ticket_readiness.sql |
| 2026-08-22 | 20291218245920_normalize_simplified_festival_running_order.sql |
| 2026-08-22 | 20291218250000_city_governance_authority.sql |
| 2026-08-22 | 20291218251000_city_governance_rls_profile_fix.sql |
| 2026-08-22 | 20291218252000_city_development_simulation.sql |
| 2026-08-22 | 20291218252100_city_development_gig_demand.sql |
| 2026-08-23 | 20291218250000_festival_licence_capacity_ceiling.sql |
| 2026-08-23 | 20291218250100_festival_licence_operating_ceilings.sql |
| 2026-08-23 | 20291218250200_festival_artist_candidate_fee_bigint.sql |
| 2026-08-23 | 20291218250300_festival_server_authoritative_ticket_demand.sql |
| 2026-08-23 | 20291218250400_simplified_festival_automatic_sponsorship_budget.sql |
| 2026-08-23 | 20291218250500_repair_festival_edition_lineup_contract.sql |
| 2026-08-23 | 20291218250600_harden_festival_artist_opportunities_privileges.sql |
| 2026-08-23 | 20291218252000_city_festival_permit_authority.sql |
| 2026-08-23 | 20291218252100_city_festival_permit_edition_api.sql |
| 2026-08-23 | 20291218252200_simplify_festival_permits_to_automatic_simulation.sql |
| 2026-08-23 | 20291218252300_festival_runtime_currency_code.sql |
| 2026-08-23 | 20291218252400_festival_owner_currency_consistency.sql |
| 2026-08-23 | 20291218252500_harden_festival_upgrade_internal_helpers.sql |
| 2026-08-23 | 20291218252600_festival_player_act_launch_authority.sql |
| 2026-08-23 | 20291218252700_festival_attendee_foundation.sql |
| 2026-08-23 | 20291218252700_restrict_legacy_festival_runtime_rpcs.sql |
| 2026-08-23 | 20291218254000_festival_checkin_readiness_and_wristbands.sql |
| 2026-08-23 | 20291218254500_festival_attendee_checkin_leave.sql |
| 2026-08-23 | 20291218254500_festival_memorabilia_launch_index.sql |
| 2026-08-23 | 20291218255000_festival_mode_schedule_lock.sql |
| 2026-08-23 | 20291218255100_enforce_festival_schedule_reservation.sql |
| 2026-08-23 | 20291218255200_festival_attendee_completion_recovery.sql |
| 2026-08-23 | 20291218255300_festival_day_planner.sql |
| 2026-08-23 | 20291218255400_harden_festival_day_planner.sql |
| 2026-08-23 | 20291218255500_festival_day_planner_indexes.sql |
| 2026-08-23 | 20291218255600_festival_condition_activities.sql |
| 2026-08-24 | 20291219000000_close_canonical_festival_performance_sessions.sql |
| 2026-08-24 | 20291219010000_festival_performance_readiness_authority.sql |
| 2026-08-24 | 20291219020000_festival_performance_resolution_authority.sql |
| 2026-08-24 | 20291219030000_festival_settlement_and_career_effects.sql |
| 2026-08-24 | 20291219030100_festival_settlement_retry_hardening.sql |
| 2026-08-24 | 20291219040000_festival_organiser_lifecycle_audit.sql |
| 2026-08-24 | 20291219040100_festival_organiser_lifecycle_hardening.sql |
| 2026-08-24 | 20291219040200_festival_artist_schedule_queue_fix.sql |
| 2026-08-24 | 20291219050000_festival_ticket_vendor_analytics_closure.sql |
| 2026-08-24 | 20291219050100_festival_ticket_vendor_analytics_hardening.sql |
| 2026-08-25 | 20291219060000_festival_b7_direct_invitation_projection.sql |
| 2026-08-25 | 20291219070000_festival_b7_collaboration_voting_closure.sql |
| 2026-08-25 | 20291219080000_festival_c1_wristband_inventory.sql |
| 2026-08-25 | 20291219090000_festival_c2_attendee_lifecycle.sql |
| 2026-08-25 | 20291219100000_festival_c4_schedule_activity_authority.sql |
| 2026-08-25 | 20291219110000_festival_c5_day_planner_foundation.sql |
| 2026-08-25 | 20291219110000_festival_c5_day_planner_stage_schedule.sql |
| 2026-08-25 | 20291219110100_festival_c5_stage_schedule_bridge.sql |
| 2026-08-25 | 20291219110200_festival_c5_day_plan_commit_projection.sql |
| 2026-09-06 | 20300106090000_expand_mayor_university_city_upgrades.sql |
| 2026-09-06 | 20300106101500_university_upgrade_cooldowns.sql |
| 2026-09-07 | 20291219110050_festival_c5_compatibility_fk_handoff.sql |
| 2026-09-25 | 20291220103000_public_festival_pre_event_lineup_sales.sql |
| 2026-09-26 | 20291220104000_guard_simplified_festival_finalisation.sql |
| 2026-09-26 | 20291220104100_guard_public_festival_history.sql |
| 2026-09-26 | 20291220104200_confirmed_acts_before_filler.sql |
| 2026-09-26 | 20291220104300_atomic_simplified_artist_payouts.sql |
| 2026-09-26 | 20291220104400_audited_premature_festival_rerun.sql |
| 2026-09-26 | 20291220104500_simplified_artist_payout_receipts.sql |
| 2026-09-26 | 20291220110000_member_festival_appearances.sql |
| 2026-09-26 | 20291220110100_confirmed_festival_slots_and_local_timezone.sql |
| 2026-09-27 | 20291220103100_festival_public_curated_npc_lineup.sql |
| 2026-09-27 | 20291220103200_festival_public_edition_identity.sql |
| 2026-09-27 | 20291220112000_festival_ticket_sales_end_guard.sql |
| 2026-09-27 | 20291220112100_festival_close_expired_ticket_sales.sql |
| 2026-09-27 | 20291220112200_festival_player_ticket_sales_breakdown.sql |
| 2026-09-27 | 20300106110000_allow_public_player_band_invitations.sql |
| 2026-09-27 | 20300106120000_fix_band_invitation_notification_route.sql |
| 2026-09-27 | 20300106130000_notify_band_invitation_responses.sql |
| 2026-09-27 | 20300106140000_live_band_invitation_updates.sql |
| 2026-09-28 | 20291220090000_link_festival_sponsors_to_canonical_brands.sql |
| 2026-09-28 | 20291220092000_enforce_festival_sponsor_slots.sql |
| 2026-09-28 | 20291220093000_festival_sponsor_slot_readiness.sql |
| 2026-09-28 | 20291220094000_festival_canonical_brand_discovery.sql |
| 2026-09-28 | 20291220095000_require_festival_main_sponsor_at_launch.sql |
| 2026-09-28 | 20291220096000_add_festival_canonical_brand_prospect.sql |
| 2026-09-28 | 20291220097000_preserve_automatic_festival_sponsor_launch.sql |
| 2026-09-28 | 20291221100000_festival_next_edition_dates_guard.sql |
| 2026-10-04 | 20300101010000_festival_offer_withdraw_and_expiry.sql |
| 2026-10-07 | 20300106150000_share_moment_snapshots.sql |
| 2026-10-13 | 20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql |
| 2026-10-13 | 20300106170000_repair_band_recruitment_capacity_applications_expiry.sql |
| 2026-10-13 | 20300106180000_correct_recruitment_approvals_and_departures.sql |
| 2026-10-13 | 20300106181000_character_scoped_notification_archive.sql |
| 2026-10-13 | 20300106182000_atomic_chart_entry_notifications.sql |
| 2026-10-13 | 20300106190000_harden_band_governance_profile_identity.sql |
| 2026-10-14 | 20300106200000_atomic_personal_funded_gig_booking.sql |
| 2026-10-14 | 20300106200000_secure_atomic_weekly_band_payroll.sql |
| 2026-10-14 | 20300106201000_controlled_random_event_backlog_reconciliation.sql |
| 2026-10-14 | 20300106210000_rehearsal_booking_full_intent_idempotency.sql |
