CREATE TABLE IF NOT EXISTS public.totp_episode_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL UNIQUE REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  theme text,
  opening_link text,
  closing_link text,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.totp_episode_plans TO authenticated;
GRANT ALL ON public.totp_episode_plans TO service_role;

ALTER TABLE public.totp_episode_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage totp episode plans" ON public.totp_episode_plans;
CREATE POLICY "Admins manage totp episode plans"
ON public.totp_episode_plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS totp_episode_plans_updated_at ON public.totp_episode_plans;
CREATE TRIGGER totp_episode_plans_updated_at
BEFORE UPDATE ON public.totp_episode_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weekly schedule feed
CREATE OR REPLACE FUNCTION public.totp_admin_broadcast_schedule(p_from date DEFAULT NULL, p_weeks integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := COALESCE(p_from, (now() AT TIME ZONE 'Europe/London')::date);
  v_weeks integer := GREATEST(1, LEAST(COALESCE(p_weeks, 8), 26));
  v_start date;
  v_end date;
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view the Top of the Pops schedule';
  END IF;

  v_start := v_from - ((EXTRACT(ISODOW FROM v_from)::int - 1));
  v_end := v_start + (v_weeks * 7) - 1;

  SELECT jsonb_build_object(
    'week_start', v_start,
    'week_end', v_end,
    'weeks', v_weeks,
    'episodes', COALESCE(jsonb_agg(ep ORDER BY ep->>'episode_date'), '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'episode_number', e.episode_number,
      'episode_date', e.episode_date,
      'status', e.status,
      'show_variant', e.show_variant,
      'presenter_key', e.presenter_key,
      'broadcast_profile', e.broadcast_profile,
      'broadcast_at', e.broadcast_at,
      'check_in_at', e.check_in_at,
      'chart_snapshot_date', e.chart_snapshot_date,
      'max_performances', e.max_performances,
      'city_id', e.city_id,
      'city_name', c.name,
      'performance_count', (SELECT count(*) FROM public.totp_performances p WHERE p.episode_id = e.id),
      'invitation_count', (SELECT count(*) FROM public.totp_invitations i WHERE i.episode_id = e.id),
      'checked_in_count', (SELECT count(*) FROM public.totp_invitations i WHERE i.episode_id = e.id AND i.status = 'checked_in'),
      'has_manifest', EXISTS (SELECT 1 FROM public.totp_episode_manifests m WHERE m.episode_id = e.id),
      'has_plan', EXISTS (SELECT 1 FROM public.totp_episode_plans pl WHERE pl.episode_id = e.id)
    ) AS ep
    FROM public.totp_episodes e
    LEFT JOIN public.cities c ON c.id = e.city_id
    WHERE e.episode_date BETWEEN v_start AND v_end
  ) rows;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_broadcast_schedule(date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_broadcast_schedule(date, integer) TO authenticated;

-- Create / edit a future episode
CREATE OR REPLACE FUNCTION public.totp_admin_upsert_episode(
  p_episode_id uuid,
  p_episode_date date,
  p_broadcast_at timestamptz,
  p_check_in_at timestamptz,
  p_chart_snapshot_date date,
  p_city_id uuid,
  p_presenter_key text,
  p_show_variant text,
  p_max_performances integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_number bigint;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can plan Top of the Pops episodes';
  END IF;

  IF p_episode_date IS NULL THEN
    RAISE EXCEPTION 'An air date is required';
  END IF;

  IF p_episode_id IS NULL AND p_episode_date < v_today THEN
    RAISE EXCEPTION 'New episodes must be scheduled for today or later';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_episodes e
    WHERE e.episode_date = p_episode_date
      AND (p_episode_id IS NULL OR e.id <> p_episode_id)
  ) THEN
    RAISE EXCEPTION 'An episode is already scheduled for %', p_episode_date;
  END IF;

  IF p_episode_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.totp_episodes WHERE id = p_episode_id) THEN
      RAISE EXCEPTION 'Episode not found';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.totp_episodes
      WHERE id = p_episode_id AND status IN ('broadcast', 'completed')
    ) THEN
      RAISE EXCEPTION 'Episodes that have already aired cannot be changed';
    END IF;

    UPDATE public.totp_episodes
    SET episode_date = p_episode_date,
        broadcast_at = COALESCE(p_broadcast_at, broadcast_at),
        check_in_at = COALESCE(p_check_in_at, check_in_at),
        chart_snapshot_date = COALESCE(p_chart_snapshot_date, chart_snapshot_date),
        city_id = COALESCE(p_city_id, city_id),
        presenter_key = COALESCE(NULLIF(p_presenter_key, ''), presenter_key),
        show_variant = COALESCE(NULLIF(p_show_variant, ''), show_variant),
        max_performances = COALESCE(p_max_performances, max_performances),
        updated_at = now()
    WHERE id = p_episode_id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  IF p_city_id IS NULL THEN
    RAISE EXCEPTION 'A host city is required';
  END IF;

  SELECT COALESCE(max(episode_number), 0) + 1 INTO v_number FROM public.totp_episodes;

  INSERT INTO public.totp_episodes (
    episode_date, episode_number, status, chart_snapshot_date, city_id,
    check_in_at, broadcast_at, max_performances, presenter_key, show_variant
  ) VALUES (
    p_episode_date,
    v_number,
    'scheduled',
    COALESCE(p_chart_snapshot_date, p_episode_date - 1),
    p_city_id,
    COALESCE(p_check_in_at, (p_episode_date::timestamp + interval '18 hours') AT TIME ZONE 'Europe/London'),
    COALESCE(p_broadcast_at, (p_episode_date::timestamp + interval '19 hours 30 minutes') AT TIME ZONE 'Europe/London'),
    COALESCE(p_max_performances, 10),
    COALESCE(NULLIF(p_presenter_key, ''), 'alex_rayne'),
    COALESCE(NULLIF(p_show_variant, ''), 'regular')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_upsert_episode(uuid, date, timestamptz, timestamptz, date, uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_upsert_episode(uuid, date, timestamptz, timestamptz, date, uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_cancel_episode(p_episode_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can cancel Top of the Pops episodes';
  END IF;

  SELECT episode_date, status INTO v_date, v_status
  FROM public.totp_episodes WHERE id = p_episode_id;

  IF v_date IS NULL THEN
    RAISE EXCEPTION 'Episode not found';
  END IF;

  IF v_status IN ('broadcast', 'completed') THEN
    RAISE EXCEPTION 'Episodes that have already aired cannot be cancelled';
  END IF;

  UPDATE public.totp_episodes
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_episode_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_cancel_episode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_cancel_episode(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_save_episode_plan(p_episode_id uuid, p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_episode_plans;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can save an episode plan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.totp_episodes WHERE id = p_episode_id) THEN
    RAISE EXCEPTION 'Episode not found';
  END IF;

  INSERT INTO public.totp_episode_plans AS pl (
    episode_id, theme, opening_link, closing_link, segments, notes, updated_by
  ) VALUES (
    p_episode_id,
    NULLIF(p_plan->>'theme', ''),
    NULLIF(p_plan->>'opening_link', ''),
    NULLIF(p_plan->>'closing_link', ''),
    COALESCE(p_plan->'segments', '[]'::jsonb),
    NULLIF(p_plan->>'notes', ''),
    auth.uid()
  )
  ON CONFLICT (episode_id) DO UPDATE
  SET theme = EXCLUDED.theme,
      opening_link = EXCLUDED.opening_link,
      closing_link = EXCLUDED.closing_link,
      segments = EXCLUDED.segments,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING pl.* INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_save_episode_plan(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_episode_plan(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_episode_plan(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_episode_plans;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can read an episode plan';
  END IF;

  SELECT * INTO v_row FROM public.totp_episode_plans WHERE episode_id = p_episode_id;
  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_episode_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_episode_plan(uuid) TO authenticated;