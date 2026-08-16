
-- 1. Achievements should be per character, not per account.
ALTER TABLE public.player_achievements DROP CONSTRAINT IF EXISTS player_achievements_user_id_achievement_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS player_achievements_character_achievement_key
  ON public.player_achievements (achievement_id, COALESCE(profile_id, user_id));

-- 2. Shared helper RPCs
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT now(); $$;

CREATE OR REPLACE FUNCTION public.increment_user_cash(p_user_id uuid, p_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new numeric;
BEGIN
  UPDATE public.profiles
     SET cash = GREATEST(0, COALESCE(cash, 0) + ROUND(COALESCE(p_amount, 0)))
   WHERE id = p_user_id OR user_id = p_user_id
  RETURNING cash INTO v_new;
  RETURN COALESCE(v_new, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_user_fame(p_user_id uuid, p_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new numeric;
BEGIN
  UPDATE public.profiles
     SET fame = GREATEST(0, COALESCE(fame, 0) + ROUND(COALESCE(p_amount, 0)))
   WHERE id = p_user_id OR user_id = p_user_id
  RETURNING fame INTO v_new;
  RETURN COALESCE(v_new, 0);
END; $$;

-- Generic band counter increment (legacy call signature: row_id + amount)
CREATE OR REPLACE FUNCTION public.increment_value(row_id uuid, amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new numeric;
BEGIN
  UPDATE public.bands
     SET fame = GREATEST(0, COALESCE(fame, 0) + ROUND(COALESCE(amount, 0))),
         updated_at = now()
   WHERE id = row_id
  RETURNING fame INTO v_new;
  RETURN COALESCE(v_new, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_performance_count(band_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new integer;
BEGIN
  UPDATE public.bands
     SET performance_count = COALESCE(performance_count, 0) + 1, updated_at = now()
   WHERE id = increment_performance_count.band_id
  RETURNING performance_count INTO v_new;
  RETURN COALESCE(v_new, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_profile_xp(profile_id_param uuid, xp_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new integer;
BEGIN
  UPDATE public.profiles
     SET experience = GREATEST(0, COALESCE(experience, 0) + COALESCE(xp_amount, 0))
   WHERE id = profile_id_param
  RETURNING experience INTO v_new;
  RETURN COALESCE(v_new, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_relationship_score(
  p_entity_a_id uuid, p_entity_b_id uuid, p_field text, p_delta numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_delta numeric := COALESCE(p_delta, 0);
BEGIN
  IF p_field NOT IN ('affection_score','trust_score','attraction_score','loyalty_score','jealousy_score') THEN
    RAISE EXCEPTION 'invalid_relationship_field';
  END IF;

  SELECT id INTO v_id FROM public.character_relationships
   WHERE (entity_a_id = p_entity_a_id AND entity_b_id = p_entity_b_id)
      OR (entity_a_id = p_entity_b_id AND entity_b_id = p_entity_a_id)
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.character_relationships (entity_a_id, entity_b_id)
    VALUES (p_entity_a_id, p_entity_b_id)
    RETURNING id INTO v_id;
  END IF;

  EXECUTE format(
    'UPDATE public.character_relationships SET %I = GREATEST(0, LEAST(100, COALESCE(%I,0) + $1)), last_interaction_at = now(), updated_at = now() WHERE id = $2',
    p_field, p_field
  ) USING v_delta, v_id;

  RETURN jsonb_build_object('relationshipId', v_id, 'field', p_field, 'delta', v_delta);
END; $$;

CREATE OR REPLACE FUNCTION public.update_player_health(p_user_id uuid, p_health_change numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new integer;
BEGIN
  UPDATE public.profiles
     SET health = GREATEST(0, LEAST(100, COALESCE(health, 100) + ROUND(COALESCE(p_health_change, 0))))
   WHERE id = p_user_id OR user_id = p_user_id
  RETURNING health INTO v_new;
  RETURN COALESCE(v_new, 0);
END; $$;

GRANT EXECUTE ON FUNCTION
  public.get_server_time(),
  public.increment_user_cash(uuid, numeric),
  public.increment_user_fame(uuid, numeric),
  public.increment_value(uuid, numeric),
  public.increment_performance_count(uuid),
  public.increment_profile_xp(uuid, integer),
  public.increment_relationship_score(uuid, uuid, text, numeric),
  public.update_player_health(uuid, numeric)
TO authenticated, service_role;

-- 3. Repair failing scheduled jobs
DO $$
DECLARE v_tables text[] := ARRAY[
  'net._http_response','cron.job_run_details','public.cron_job_runs','public.activity_feed',
  'public.notifications','public.player_inbox','public.experience_ledger','public.game_activity_logs',
  'public.twaater_notifications','public.twaats','public.chart_entries',
  'public.streaming_analytics_daily','public.song_plays'];
  v_tbl text; v_i integer := 0; v_min integer;
BEGIN
  PERFORM cron.unschedule('vacuum-high-churn-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('vacuum-full-logs-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- One VACUUM per job so each command is a single statement (VACUUM cannot run in a transaction block).
SELECT cron.schedule('vacuum-http-response-hourly', '7 * * * *', 'VACUUM (ANALYZE) net._http_response');
SELECT cron.schedule('vacuum-cron-run-details-hourly', '12 * * * *', 'VACUUM (ANALYZE) cron.job_run_details');
SELECT cron.schedule('vacuum-cron-job-runs-hourly', '17 * * * *', 'VACUUM (ANALYZE) public.cron_job_runs');
SELECT cron.schedule('vacuum-activity-feed-hourly', '22 * * * *', 'VACUUM (ANALYZE) public.activity_feed');
SELECT cron.schedule('vacuum-notifications-hourly', '27 * * * *', 'VACUUM (ANALYZE) public.notifications');
SELECT cron.schedule('vacuum-player-inbox-hourly', '32 * * * *', 'VACUUM (ANALYZE) public.player_inbox');
SELECT cron.schedule('vacuum-experience-ledger-hourly', '37 * * * *', 'VACUUM (ANALYZE) public.experience_ledger');
SELECT cron.schedule('vacuum-twaats-hourly', '42 * * * *', 'VACUUM (ANALYZE) public.twaats');
SELECT cron.schedule('vacuum-chart-entries-hourly', '47 * * * *', 'VACUUM (ANALYZE) public.chart_entries');
SELECT cron.schedule('vacuum-song-plays-hourly', '52 * * * *', 'VACUUM (ANALYZE) public.song_plays');

-- History pruning: cron_job_runs has completed_at, not finished_at.
SELECT cron.schedule(
  'prune-pgnet-and-cron-history',
  '25 3 * * *',
  $prune$
  DELETE FROM net._http_response   WHERE created      < now() - interval '24 hours';
  DELETE FROM cron.job_run_details WHERE end_time     < now() - interval '24 hours';
  DELETE FROM public.cron_job_runs WHERE COALESCE(completed_at, started_at, created_at) < now() - interval '7 days';
  $prune$
);

-- Demo reviews: use the real function URL and key instead of missing vault secrets.
SELECT cron.schedule(
  'process-demo-reviews',
  '15 * * * *',
  $demo$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-demo-review',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $demo$
);
