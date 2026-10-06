\set ON_ERROR_STOP on
BEGIN;

DO $coma_regression$
DECLARE
  v_inactive_user constant uuid := 'ca000000-0000-4000-8000-000000000001';
  v_active_user constant uuid := 'ca000000-0000-4000-8000-000000000002';
  v_inactive_profile_a constant uuid := 'ca100000-0000-4000-8000-000000000001';
  v_inactive_profile_b constant uuid := 'ca100000-0000-4000-8000-000000000002';
  v_active_profile_a constant uuid := 'ca200000-0000-4000-8000-000000000001';
  v_active_profile_b constant uuid := 'ca200000-0000-4000-8000-000000000002';
  v_result jsonb;
BEGIN
  INSERT INTO auth.users (id, email, role, last_sign_in_at)
  VALUES
    (v_inactive_user, 'coma-inactive@example.test', 'authenticated', now() - interval '40 days'),
    (v_active_user, 'coma-active@example.test', 'authenticated', now() - interval '40 days')
  ON CONFLICT (id) DO UPDATE
    SET last_sign_in_at = EXCLUDED.last_sign_in_at;

  -- Some local schemas auto-create a starter profile on auth.users insert.
  DELETE FROM public.profiles
   WHERE user_id IN (v_inactive_user, v_active_user);

  INSERT INTO public.profiles (
    id, user_id, username, display_name, is_active, slot_number, last_login_at
  )
  VALUES
    (
      v_inactive_profile_a, v_inactive_user, 'coma-test-inactive-a',
      'Coma Test Inactive A', true, 1, now() - interval '40 days'
    ),
    (
      v_inactive_profile_b, v_inactive_user, 'coma-test-inactive-b',
      'Coma Test Inactive B', false, 2, now() - interval '35 days'
    ),
    (
      v_active_profile_a, v_active_user, 'coma-test-active-a',
      'Coma Test Active A', true, 1, now() - interval '40 days'
    ),
    (
      v_active_profile_b, v_active_user, 'coma-test-active-b',
      'Coma Test Active B', false, 2, now() - interval '5 days'
    );

  v_result := public.process_inactive_character_comas();

  IF (v_result->>'threshold_days')::integer <> 30 THEN
    RAISE EXCEPTION 'Expected 30-day inactivity threshold, got %', v_result;
  END IF;

  IF v_result->>'activity_scope' <> 'account' THEN
    RAISE EXCEPTION 'Expected account-wide inactivity scope, got %', v_result;
  END IF;

  IF (
    SELECT count(*)
    FROM public.profiles
    WHERE id IN (v_inactive_profile_a, v_inactive_profile_b)
      AND died_at IS NOT NULL
      AND death_cause = 'Coma (30 days inactivity)'
      AND is_active = false
  ) <> 2 THEN
    RAISE EXCEPTION 'Fully inactive account did not place both living slots into coma';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id IN (v_active_profile_a, v_active_profile_b)
      AND died_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Recent activity on one character failed to protect the whole account';
  END IF;

  IF (
    SELECT count(*)
    FROM public.character_coma_events
    WHERE profile_id IN (v_inactive_profile_a, v_inactive_profile_b)
      AND event_type = 'entered'
      AND source = 'scheduled_inactivity_check'
      AND account_last_activity_at IS NOT NULL
  ) <> 2 THEN
    RAISE EXCEPTION 'Automatic coma entry audit events were not written correctly';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.character_coma_events', 'SELECT')
     OR has_table_privilege('authenticated', 'public.character_coma_events', 'INSERT')
     OR has_table_privilege('authenticated', 'public.character_coma_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.character_coma_events', 'DELETE')
     OR has_table_privilege('anon', 'public.character_coma_events', 'SELECT')
  THEN
    RAISE EXCEPTION 'Coma audit table privileges are not read-only for authenticated players';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_inactive_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_inactive_user::text, 'role', 'authenticated')::text,
    true
  );

  PERFORM public.resurrect_character(v_inactive_profile_a);

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_inactive_profile_a
      AND (
        died_at IS NOT NULL
        OR death_cause IS NOT NULL
        OR is_active IS DISTINCT FROM true
        OR coma_started_at IS NOT NULL
        OR coma_last_account_activity_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Player revival did not clear the coma snapshot and reactivate the character';
  END IF;

  IF (
    SELECT count(*)
    FROM public.character_coma_events
    WHERE profile_id = v_inactive_profile_a
      AND event_type = 'revived'
      AND source = 'player_revival'
  ) <> 1 THEN
    RAISE EXCEPTION 'Player revival was not added to the coma event history';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_inactive_profile_b
      AND died_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Reviving one character unexpectedly revived all character slots';
  END IF;
END
$coma_regression$;

SELECT 'Coma inactivity account scope, audit logging, security and revival regression checks passed' AS result;
ROLLBACK;
