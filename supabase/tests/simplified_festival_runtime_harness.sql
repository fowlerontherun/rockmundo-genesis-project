\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA IF NOT EXISTS test_simplified_festival_runtime;
CREATE OR REPLACE FUNCTION test_simplified_festival_runtime.as_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
END
$$;

DO $$
DECLARE
  user_id constant uuid := '84f50000-0000-4000-8000-000000000001';
  profile_id constant uuid := '84f50000-0000-4000-8000-000000000002';
  setup_key constant uuid := '84f50000-0000-4000-8000-000000000003';
  run_key constant uuid := '84f50000-0000-4000-8000-000000000004';
  company_id uuid;
  festival_company_id uuid;
  edition_id uuid;
  city_id uuid;
  configuration_version integer;
  edition_version integer;
  site_plan_id uuid;
  ticket_plan_id uuid;
  programme_id uuid;
  offer_id uuid;
  setup jsonb;
  result jsonb;
  readiness jsonb;
  first_runtime jsonb;
  replay_runtime jsonb;
  runtime_id uuid;
  runtime_count integer;
  schedule_item_count integer;
  npc_count integer;
BEGIN
  INSERT INTO auth.users(id, email, role)
  VALUES(user_id, 'simplified-festival-runtime@example.test', 'authenticated');

  INSERT INTO public.profiles(
    id, user_id, username, display_name, cash, is_active, is_vip
  ) VALUES (
    profile_id, user_id, 'simplified_festival_runtime',
    'Simplified Festival Runtime', 10000000, true, true
  );

  INSERT INTO public.vip_subscriptions(
    user_id, status, subscription_type, starts_at, expires_at
  ) VALUES (
    user_id, 'active', 'test', now() - interval '1 day', now() + interval '30 days'
  );

  PERFORM public.get_or_create_primary_financial_account(
    'player', profile_id, 'Simplified Festival runtime player', 'GBP'
  );
  UPDATE public.financial_accounts
  SET current_balance_minor = 1000000000
  WHERE owner_type = 'player'
    AND owner_id = profile_id
    AND is_primary;

  UPDATE public.game_config
  SET config_value = config_value || jsonb_build_object(
    'new_festival_system_enabled', true,
    'festival_company_creation_enabled', true,
    'festival_company_management_enabled', true,
    'company_limit', 3
  )
  WHERE config_key = 'festival_company_creation';

  PERFORM test_simplified_festival_runtime.as_user(user_id);
  result := public.found_festival_company(
    'Runtime Loop Festival',
    'Runtime Loop Festival Ltd',
    'Authenticated simplified Festival runtime fixture',
    'simplified-runtime-founding'
  );
  company_id := (result->>'companyId')::uuid;
  festival_company_id := (result->>'festivalCompanyId')::uuid;

  RESET ROLE;
  PERFORM public.get_or_create_primary_financial_account(
    'company', company_id, 'Runtime Loop Festival company', 'GBP'
  );
  UPDATE public.financial_accounts
  SET current_balance_minor = 1000000000
  WHERE owner_type = 'company'
    AND owner_id = company_id
    AND is_primary;
  UPDATE public.companies
  SET reputation_score = 1000
  WHERE id = company_id;

  INSERT INTO public.festival_company_licences(
    festival_company_id, tier_key, status, valid_from, valid_until
  )
  SELECT festival_company_id, tier.key, 'active',
         now() - interval '1 day', now() + interval '1 year'
  FROM public.festival_licence_tiers tier
  WHERE tier.active
  ORDER BY tier.rank DESC
  LIMIT 1;

  SELECT id INTO city_id
  FROM public.cities
  ORDER BY id
  LIMIT 1;
  IF city_id IS NULL THEN
    RAISE EXCEPTION 'simplified Festival runtime fixture requires a city';
  END IF;

  SELECT configuration.configuration_version
  INTO configuration_version
  FROM public.festival_configurations configuration
  WHERE configuration.festival_company_id = festival_company_id;

  setup := jsonb_build_object(
    'publicName', 'Runtime Loop Festival',
    'shortName', 'Runtime Loop',
    'tagline', 'Automatic Festival runtime proof',
    'description', 'Authenticated simplified Festival runtime fixture for the one-action Run Festival flow.',
    'annualMonth', extract(month from current_date)::integer,
    'homeCityId', city_id,
    'festivalScale', 'local',
    'vibe', (SELECT key FROM public.festival_vibe_catalogue WHERE active ORDER BY sort_order LIMIT 1),
    'siteType', 'outdoor',
    'environmentalPolicy', (SELECT key FROM public.festival_environmental_policy_catalogue WHERE active ORDER BY sort_order LIMIT 1),
    'plannedStartDate', current_date,
    'plannedEndDate', current_date
  );

  PERFORM test_simplified_festival_runtime.as_user(user_id);
  result := public.complete_festival_setup_with_edition(
    festival_company_id,
    configuration_version,
    setup,
    setup_key
  );
  edition_id := (result->>'festivalEditionId')::uuid;
  IF edition_id IS NULL THEN
    RAISE EXCEPTION 'annual Festival edition was not created';
  END IF;

  RESET ROLE;
  UPDATE public.festival_editions_v2
  SET planning_status = 'ready',
      readiness_score = 100,
      expected_capacity = 500,
      estimated_operating_cost_minor = 125000,
      starts_on = current_date,
      ends_on = current_date,
      duration_days = 1,
      status = 'draft',
      locked_at = NULL
  WHERE id = edition_id;

  PERFORM test_simplified_festival_runtime.as_user(user_id);
  result := public.materialize_festival_edition_foundations(
    festival_company_id,
    edition_id
  );
  IF coalesce((result->>'materialized')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'annual Festival foundations were not materialized: %', result;
  END IF;

  RESET ROLE;
  SELECT site.id INTO site_plan_id
  FROM public.festival_site_plans site
  WHERE site.festival_edition_id = edition_id;
  SELECT ticket.id INTO ticket_plan_id
  FROM public.festival_ticket_plans ticket
  WHERE ticket.festival_edition_id = edition_id;

  IF site_plan_id IS NULL OR ticket_plan_id IS NULL THEN
    RAISE EXCEPTION 'hidden site/ticket foundations are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_site_plan_stages stage
    WHERE stage.festival_site_plan_id = site_plan_id
      AND stage.status = 'ready'
  ) THEN
    RAISE EXCEPTION 'hidden generated stages are missing';
  END IF;

  UPDATE public.festival_ticket_plans
  SET owner_confirmed_at = now()
  WHERE id = ticket_plan_id;

  INSERT INTO public.festival_artist_programmes(
    festival_company_id,
    festival_edition_id,
    festival_ticket_plan_id,
    currency_code,
    application_mode,
    preferred_genres,
    excluded_genres,
    artist_budget_minor,
    contingency_budget_minor,
    minimum_player_artist_share_basis_points,
    status,
    planning_version,
    completed_at
  ) VALUES (
    festival_company_id,
    edition_id,
    ticket_plan_id,
    'GBP',
    'invite_only',
    '{}',
    '{}',
    500000,
    50000,
    0,
    'ready_for_operations',
    1,
    now()
  )
  RETURNING id INTO programme_id;

  INSERT INTO public.festival_artist_offers(
    festival_artist_programme_id,
    artist_type,
    artist_profile_id,
    status,
    offered_fee_minor,
    currency_code,
    set_minutes,
    performance_count,
    billing_position,
    travel_support_minor,
    accommodation_support_minor,
    merch_revenue_share_basis_points,
    offer_version,
    created_by_profile_id,
    accepted_at
  ) VALUES (
    programme_id,
    'solo',
    profile_id,
    'accepted',
    50000,
    'GBP',
    45,
    1,
    'headliner',
    0,
    0,
    0,
    1,
    profile_id,
    now()
  )
  RETURNING id INTO offer_id;

  INSERT INTO public.festival_artist_bookings(
    festival_artist_programme_id,
    offer_id,
    artist_type,
    artist_profile_id,
    status,
    agreed_fee_minor,
    travel_support_minor,
    accommodation_support_minor,
    total_commitment_minor,
    currency_code,
    set_minutes,
    performance_count,
    billing_position,
    contract_terms,
    confirmed_at
  ) VALUES (
    programme_id,
    offer_id,
    'solo',
    profile_id,
    'confirmed',
    50000,
    0,
    0,
    50000,
    'GBP',
    45,
    1,
    'headliner',
    '{}'::jsonb,
    now()
  );

  SELECT version INTO edition_version
  FROM public.festival_editions_v2
  WHERE id = edition_id;

  PERFORM test_simplified_festival_runtime.as_user(user_id);
  readiness := public.get_simplified_festival_run_readiness(
    festival_company_id,
    edition_id
  );
  IF coalesce((readiness->>'canRun')::boolean, false) IS NOT TRUE
     OR jsonb_array_length(readiness->'blockers') <> 0 THEN
    RAISE EXCEPTION 'simplified Festival should be runnable: %', readiness;
  END IF;
  IF coalesce((readiness->>'ticketsConfirmed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'owner-confirmed ticket boundary was not recognised';
  END IF;
  IF (readiness->>'confirmedActs')::integer <> 1 THEN
    RAISE EXCEPTION 'expected one confirmed player act: %', readiness;
  END IF;

  first_runtime := public.run_simplified_festival_edition(
    festival_company_id,
    edition_id,
    edition_version,
    run_key
  );
  runtime_id := (first_runtime->>'runtimeId')::uuid;
  IF runtime_id IS NULL OR first_runtime->>'state' <> 'completed' THEN
    RAISE EXCEPTION 'simplified Festival did not complete: %', first_runtime;
  END IF;

  replay_runtime := public.run_simplified_festival_edition(
    festival_company_id,
    edition_id,
    edition_version,
    run_key
  );
  IF (replay_runtime->>'runtimeId')::uuid IS DISTINCT FROM runtime_id THEN
    RAISE EXCEPTION 'replay created or returned a different runtime';
  END IF;

  RESET ROLE;
  SELECT count(*) INTO runtime_count
  FROM public.festival_edition_runtimes runtime
  WHERE runtime.edition_id = edition_id;
  IF runtime_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one runtime, found %', runtime_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_edition_runtimes runtime
    WHERE runtime.id = runtime_id
      AND runtime.schedule_source = 'simplified_generated'
      AND runtime.schedule_revision_id IS NULL
      AND jsonb_array_length(runtime.generated_schedule->'stages') > 0
      AND jsonb_array_length(runtime.generated_schedule->'items') > 0
      AND runtime.site_attendance = 0
      AND runtime.departed_attendance = runtime.admitted_attendance
  ) THEN
    RAISE EXCEPTION 'edition-native generated schedule or attendance conservation is invalid';
  END IF;

  SELECT jsonb_array_length(runtime.generated_schedule->'items')
  INTO schedule_item_count
  FROM public.festival_edition_runtimes runtime
  WHERE runtime.id = runtime_id;
  SELECT count(*) INTO npc_count
  FROM jsonb_array_elements(
    (SELECT generated_schedule->'items'
     FROM public.festival_edition_runtimes
     WHERE id = runtime_id)
  ) item
  WHERE item->>'sourceBookingId' IS NULL;

  IF schedule_item_count <= 1 OR npc_count < 1 THEN
    RAISE EXCEPTION 'automatic NPC fill did not populate spare Festival slots';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_runtime_completion_digests digest
    WHERE digest.runtime_id = runtime_id
      AND digest.runtime_digest IS NOT NULL
      AND digest.rules_version = 'simplified-festival-runtime-v1'
  ) THEN
    RAISE EXCEPTION 'runtime completion digest is missing';
  END IF;

  IF (SELECT status FROM public.festival_editions_v2 WHERE id = edition_id) <> 'completed' THEN
    RAISE EXCEPTION 'annual edition was not marked completed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_public_legacy_bridges bridge
    WHERE bridge.festival_company_id = festival_company_id
      AND bridge.festival_edition_id = edition_id
  ) THEN
    RAISE EXCEPTION 'simplified runtime created a forbidden legacy public bridge';
  END IF;

  RAISE NOTICE 'SIMPLIFIED_FESTIVAL_RUNTIME_SUMMARY runtime_count=% schedule_items=% npc_acts=% completion_digests=1 failed_assertions=0',
    runtime_count, schedule_item_count, npc_count;
END
$$;

ROLLBACK;
