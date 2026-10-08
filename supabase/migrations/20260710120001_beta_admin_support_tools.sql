-- Beta-focused admin support tools: scoped lookup, read-only summaries, audited corrections, and health metrics.

CREATE TABLE IF NOT EXISTS public.admin_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_action_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Beta admins can read admin action audit" ON public.admin_action_audit;
CREATE POLICY "Beta admins can read admin action audit"
  ON public.admin_action_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can append admin action audit through RPC" ON public.admin_action_audit;
CREATE POLICY "Admins can append admin action audit through RPC"
  ON public.admin_action_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.admin_search_players(p_query text, p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_results jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF length(v_query) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT DISTINCT ON (p.id)
      p.id AS profile_id,
      p.user_id,
      p.display_name,
      p.username,
      p.level,
      p.cash,
      p.fame,
      p.fans,
      p.current_city_id,
      p.created_at,
      c.name AS current_city_name,
      b.id AS band_id,
      b.name AS band_name,
      bm.role AS band_role
    FROM public.profiles p
    LEFT JOIN public.cities c ON c.id = p.current_city_id
    LEFT JOIN public.band_members bm ON bm.user_id = p.user_id
    LEFT JOIN public.bands b ON b.id = bm.band_id
    WHERE p.user_id::text = v_query
       OR p.id::text = v_query
       OR p.display_name ILIKE '%' || v_query || '%'
       OR p.username ILIKE '%' || v_query || '%'
       OR b.name ILIKE '%' || v_query || '%'
    ORDER BY p.id, p.updated_at DESC NULLS LAST, p.created_at DESC
    LIMIT v_limit
  ) AS row_data;

  INSERT INTO public.admin_action_audit (actor_user_id, action, target_table, metadata)
  VALUES (auth.uid(), 'admin_search_players', 'profiles', jsonb_build_object('query_length', length(v_query), 'result_count', jsonb_array_length(v_results)));

  RETURN v_results;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_player_support_summary(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_summary jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;

  SELECT jsonb_build_object(
    'profile', to_jsonb(v_profile) - 'avatar_url',
    'city', (SELECT to_jsonb(c) FROM public.cities c WHERE c.id = v_profile.current_city_id),
    'band_memberships', coalesce((
      SELECT jsonb_agg(jsonb_build_object('band_id', b.id, 'band_name', b.name, 'genre', b.genre, 'role', bm.role, 'joined_at', bm.joined_at, 'popularity', b.popularity, 'weekly_fans', b.weekly_fans))
      FROM public.band_members bm JOIN public.bands b ON b.id = bm.band_id
      WHERE bm.user_id = v_profile.user_id
    ), '[]'::jsonb),
    'activity_status', (SELECT to_jsonb(pas) FROM public.profile_activity_statuses pas WHERE pas.profile_id = v_profile.id),
    'recent_songs', coalesce((
      SELECT jsonb_agg(to_jsonb(s) - 'lyrics' - 'audio_layers') FROM (
        SELECT id, title, genre, status, quality_score, streams, revenue, chart_position, release_date, created_at, updated_at
        FROM public.songs WHERE user_id = v_profile.user_id OR profile_id = v_profile.id ORDER BY created_at DESC LIMIT 10
      ) s
    ), '[]'::jsonb),
    'recent_releases', coalesce((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, title, release_type, release_status, total_streams, total_revenue, release_date, created_at, updated_at
        FROM public.releases WHERE user_id = v_profile.user_id ORDER BY created_at DESC LIMIT 10
      ) r
    ), '[]'::jsonb),
    'recent_activity_logs', coalesce((
      SELECT jsonb_agg(to_jsonb(l)) FROM (
        SELECT id, activity_type, activity_category, description, amount, metadata, created_at
        FROM public.game_activity_logs WHERE user_id = v_profile.user_id ORDER BY created_at DESC LIMIT 15
      ) l
    ), '[]'::jsonb),
    'recent_audit_actions', coalesce((
      SELECT jsonb_agg(to_jsonb(a)) FROM (
        SELECT id, actor_user_id, action, target_table, target_id, metadata, created_at
        FROM public.admin_action_audit WHERE target_id IN (v_profile.id::text, v_profile.user_id::text) ORDER BY created_at DESC LIMIT 10
      ) a
    ), '[]'::jsonb)
  ) INTO v_summary;

  INSERT INTO public.admin_action_audit (actor_user_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'admin_view_player_support_summary', 'profiles', v_profile.id::text, jsonb_build_object('target_user_id', v_profile.user_id));

  RETURN v_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_player_cash(p_profile_id uuid, p_amount integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF length(v_reason) < 8 THEN
    RAISE EXCEPTION 'A reason of at least 8 characters is required';
  END IF;
  IF p_amount = 0 OR abs(p_amount) > 1000000 THEN
    RAISE EXCEPTION 'Cash adjustment must be between -1,000,000 and 1,000,000 and cannot be zero';
  END IF;

  SELECT cash INTO v_before FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;
  v_after := greatest(0, coalesce(v_before, 0) + p_amount);
  UPDATE public.profiles SET cash = v_after, updated_at = now() WHERE id = p_profile_id;

  INSERT INTO public.admin_action_audit (actor_user_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'admin_adjust_player_cash', 'profiles', p_profile_id::text,
    jsonb_build_object('reason', v_reason, 'previous_value', v_before, 'new_value', v_after, 'delta', p_amount));

  INSERT INTO public.game_activity_logs (user_id, activity_type, activity_category, description, amount, before_state, after_state, metadata)
  SELECT user_id, 'admin_cash_adjustment', 'economy', 'Admin cash adjustment: ' || v_reason, p_amount,
    jsonb_build_object('cash', v_before), jsonb_build_object('cash', v_after), jsonb_build_object('admin_user_id', auth.uid())
  FROM public.profiles WHERE id = p_profile_id;

  RETURN jsonb_build_object('previous_value', v_before, 'new_value', v_after, 'delta', p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_profile_activity(p_status_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.profile_activity_statuses%ROWTYPE;
  v_reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF length(v_reason) < 8 THEN
    RAISE EXCEPTION 'A reason of at least 8 characters is required';
  END IF;

  SELECT * INTO v_activity FROM public.profile_activity_statuses WHERE id = p_status_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity status not found';
  END IF;

  DELETE FROM public.profile_activity_statuses WHERE id = p_status_id;

  INSERT INTO public.admin_action_audit (actor_user_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), 'admin_cancel_profile_activity', 'profile_activity_statuses', p_status_id::text,
    jsonb_build_object('reason', v_reason, 'previous_value', to_jsonb(v_activity), 'profile_id', v_activity.profile_id));

  RETURN jsonb_build_object('cancelled_activity', to_jsonb(v_activity));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_beta_health_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'active_players_24h', (SELECT count(DISTINCT user_id) FROM public.game_activity_logs WHERE created_at >= now() - interval '24 hours'),
    'new_profiles_24h', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '24 hours'),
    'new_profiles_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'active_activity_statuses', (SELECT count(*) FROM public.profile_activity_statuses),
    'stuck_activity_statuses', (SELECT count(*) FROM public.profile_activity_statuses WHERE ends_at IS NOT NULL AND ends_at < now() - interval '1 hour'),
    'failed_recent_cron_jobs', (SELECT count(*) FROM public.cron_job_runs WHERE status <> 'success' AND started_at >= now() - interval '24 hours'),
    'recent_activity_errors', (SELECT count(*) FROM public.game_activity_logs WHERE created_at >= now() - interval '24 hours' AND (activity_type ILIKE '%error%' OR activity_category ILIKE '%error%' OR description ILIKE '%fail%')),
    'total_cash', (SELECT coalesce(sum(cash), 0) FROM public.profiles),
    'recent_admin_actions', (SELECT count(*) FROM public.admin_action_audit WHERE created_at >= now() - interval '24 hours'),
    'latest_errors', coalesce((
      SELECT jsonb_agg(to_jsonb(l)) FROM (
        SELECT id, user_id, activity_type, activity_category, description, metadata, created_at
        FROM public.game_activity_logs
        WHERE activity_type ILIKE '%error%' OR activity_category ILIKE '%error%' OR description ILIKE '%fail%'
        ORDER BY created_at DESC LIMIT 10
      ) l
    ), '[]'::jsonb),
    'latest_cron_jobs', coalesce((
      SELECT jsonb_agg(to_jsonb(c)) FROM (
        SELECT id, job_name, status, started_at, completed_at, error_message
        FROM public.cron_job_runs ORDER BY started_at DESC LIMIT 10
      ) c
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_search_players(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_player_support_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_player_cash(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_profile_activity(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_beta_health_overview() TO authenticated;
