-- Rollback-only timeout contract test. Requires one seed profile.
-- Real cron is scheduled separately; invoke the same secure sweep here to
-- validate one expired session releases the unique active-session constraint.
DO $smoke$
DECLARE v_profile uuid; v_recipe text; v_expired uuid:=gen_random_uuid();
  v_next uuid:=gen_random_uuid(); v_changed integer; v_before integer;
BEGIN
 SELECT id INTO v_profile FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM public.cooking_sessions s
     WHERE s.profile_id=p.id AND s.status IN ('pending','running'))
 LIMIT 1;
 SELECT slug INTO v_recipe FROM public.cooking_recipes
 WHERE method='pan' LIMIT 1;
 IF v_profile IS NULL OR v_recipe IS NULL THEN
   RAISE EXCEPTION 'COOKING_TIMEOUT_TEST_MISSING_PROFILE_OR_RECIPE';
 END IF;
 BEGIN
  INSERT INTO public.cooking_sessions
    (id,profile_id,recipe_slug,mode,status,started_at,expires_at)
  VALUES (v_expired,v_profile,v_recipe,'manual','pending',
    clock_timestamp()-interval '5 minutes',
    clock_timestamp()-interval '3 minutes');
  v_changed:=public.expire_cooking_sessions(500);
  IF v_changed<1 OR
      (SELECT status FROM public.cooking_sessions WHERE id=v_expired)<>'timed_out'
      OR (SELECT finished_at FROM public.cooking_sessions WHERE id=v_expired) IS NULL
      OR (SELECT result_batch_id FROM public.cooking_sessions WHERE id=v_expired) IS NOT NULL
    THEN RAISE EXCEPTION 'COOKING_TIMEOUT_SWEEP_FAILED'; END IF;

  -- The earlier expired session must not lock the player out of starting again.
  INSERT INTO public.cooking_sessions
    (id,profile_id,recipe_slug,mode,status,started_at,expires_at)
  VALUES (v_next,v_profile,v_recipe,'manual','running',
    clock_timestamp()-interval '5 minutes',
    clock_timestamp()-interval '3 minutes');
  v_changed:=public.expire_cooking_sessions(500);
  IF v_changed<1 OR
      (SELECT status FROM public.cooking_sessions WHERE id=v_next)<>'timed_out'
    THEN RAISE EXCEPTION 'COOKING_TIMEOUT_RUNNING_SWEEP_FAILED'; END IF;
  IF public.expire_cooking_sessions(500)<>0 THEN
    RAISE EXCEPTION 'COOKING_TIMEOUT_SWEEP_NOT_IDEMPOTENT'; END IF;
  SELECT count(*) INTO v_before FROM public.cooking_food_batches
    WHERE crafting_session_id IN (v_expired,v_next);
  IF v_before<>0 THEN RAISE EXCEPTION 'TIMED_OUT_COOKING_MINTED_FOOD'; END IF;

  RAISE EXCEPTION USING ERRCODE='PZ001', MESSAGE='ROLLBACK_TIMEOUT_TEST';
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN
  PERFORM set_config('app.cooking_timeout_sweep_passed','yes',false);
 END;
END $smoke$;
SELECT current_setting('app.cooking_timeout_sweep_passed',true) AS timeout_test_passed,
  (SELECT count(*) FROM public.cooking_sessions
   WHERE status IN ('pending','running') AND expires_at<=clock_timestamp()) AS expired_active_remaining,
  (SELECT count(*) FROM cron.job
   WHERE jobname='rockmundo_cooking_session_timeout'
     AND schedule='* * * * *' AND active) AS active_timeout_cron_jobs;
