-- Phase 5: rights, moderation, safety and accessibility hardening for Top of the Pops

CREATE TABLE IF NOT EXISTS public.totp_external_use_consents (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT false,
  consent_version integer NOT NULL DEFAULT 1,
  scopes text[] NOT NULL DEFAULT ARRAY['band_name','avatar','recording','lyrics']::text[],
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.totp_external_use_consents TO authenticated;
GRANT ALL ON public.totp_external_use_consents TO service_role;
ALTER TABLE public.totp_external_use_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "totp_consent_self_manage" ON public.totp_external_use_consents;
CREATE POLICY "totp_consent_self_manage" ON public.totp_external_use_consents
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "totp_consent_admin_read" ON public.totp_external_use_consents;
CREATE POLICY "totp_consent_admin_read" ON public.totp_external_use_consents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.totp_compliance_reports (
  episode_id uuid NOT NULL PRIMARY KEY REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  manifest_checksum text,
  passed boolean NOT NULL DEFAULT false,
  blocker_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  screened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.totp_compliance_reports TO authenticated;
GRANT ALL ON public.totp_compliance_reports TO service_role;
ALTER TABLE public.totp_compliance_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "totp_compliance_admin_read" ON public.totp_compliance_reports;
CREATE POLICY "totp_compliance_admin_read" ON public.totp_compliance_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.totp_episode_takedowns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  performance_id uuid REFERENCES public.totp_performances(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'remove' CHECK (action IN ('remove','replace','mute')),
  reason text NOT NULL,
  replacement_note text,
  active boolean NOT NULL DEFAULT true,
  raised_by uuid,
  cleared_by uuid,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_episode_takedowns_episode_idx
  ON public.totp_episode_takedowns (episode_id, active);

GRANT SELECT ON public.totp_episode_takedowns TO authenticated;
GRANT ALL ON public.totp_episode_takedowns TO service_role;
ALTER TABLE public.totp_episode_takedowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "totp_takedowns_admin_read" ON public.totp_episode_takedowns;
CREATE POLICY "totp_takedowns_admin_read" ON public.totp_episode_takedowns
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Player-facing consent -------------------------------------------------

CREATE OR REPLACE FUNCTION public.totp_my_broadcast_consent()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_external_use_consents;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view your broadcast consent.';
  END IF;

  SELECT * INTO v_row FROM public.totp_external_use_consents WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'user_id', auth.uid(),
      'granted', false,
      'consent_version', 1,
      'scopes', to_jsonb(ARRAY['band_name','avatar','recording','lyrics']::text[]),
      'granted_at', NULL,
      'withdrawn_at', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_row.user_id,
    'granted', v_row.granted,
    'consent_version', v_row.consent_version,
    'scopes', to_jsonb(v_row.scopes),
    'granted_at', v_row.granted_at,
    'withdrawn_at', v_row.withdrawn_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_my_broadcast_consent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_my_broadcast_consent() TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_set_broadcast_consent(p_granted boolean, p_scopes text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scopes text[] := COALESCE(p_scopes, ARRAY['band_name','avatar','recording','lyrics']::text[]);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change your broadcast consent.';
  END IF;

  INSERT INTO public.totp_external_use_consents (user_id, granted, scopes, granted_at, withdrawn_at)
  VALUES (
    auth.uid(),
    COALESCE(p_granted, false),
    v_scopes,
    CASE WHEN p_granted THEN now() ELSE NULL END,
    CASE WHEN p_granted THEN NULL ELSE now() END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET granted = COALESCE(EXCLUDED.granted, false),
      scopes = EXCLUDED.scopes,
      granted_at = CASE WHEN EXCLUDED.granted THEN COALESCE(public.totp_external_use_consents.granted_at, now()) ELSE NULL END,
      withdrawn_at = CASE WHEN EXCLUDED.granted THEN NULL ELSE now() END,
      updated_at = now();

  RETURN public.totp_my_broadcast_consent();
END;
$$;

REVOKE ALL ON FUNCTION public.totp_set_broadcast_consent(boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_set_broadcast_consent(boolean, text[]) TO authenticated;

-- Admin consent overview per episode ------------------------------------

CREATE OR REPLACE FUNCTION public.totp_admin_episode_consents(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  WITH perf AS (
    SELECT p.id AS performance_id, p.band_id, b.name AS band_name
    FROM public.totp_performances p
    JOIN public.bands b ON b.id = p.band_id
    WHERE p.episode_id = p_episode_id
  ), member_users AS (
    SELECT DISTINCT perf.performance_id, perf.band_id, perf.band_name,
           COALESCE(bm.user_id, pr.user_id) AS member_user_id
    FROM perf
    LEFT JOIN public.band_members bm ON bm.band_id = perf.band_id
    LEFT JOIN public.profiles pr ON pr.id = bm.profile_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.band_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT mu.performance_id,
           mu.band_id,
           mu.band_name,
           COUNT(mu.member_user_id) AS player_members,
           COUNT(c.user_id) FILTER (WHERE c.granted) AS consented_members,
           (COUNT(mu.member_user_id) = 0
             OR COUNT(mu.member_user_id) = COUNT(c.user_id) FILTER (WHERE c.granted)) AS consented
    FROM member_users mu
    LEFT JOIN public.totp_external_use_consents c ON c.user_id = mu.member_user_id
    GROUP BY mu.performance_id, mu.band_id, mu.band_name
  ) t;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_episode_consents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_episode_consents(uuid) TO authenticated;

-- Compliance report ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.totp_episode_compliance_report(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_compliance_reports;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT * INTO v_row FROM public.totp_compliance_reports WHERE episode_id = p_episode_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_episode_compliance_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_episode_compliance_report(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_save_compliance_report(
  p_episode_id uuid,
  p_report jsonb,
  p_passed boolean,
  p_blocker_count integer DEFAULT 0,
  p_warning_count integer DEFAULT 0,
  p_manifest_checksum text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_compliance_reports;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  INSERT INTO public.totp_compliance_reports AS r (
    episode_id, manifest_checksum, passed, blocker_count, warning_count, report, screened_by
  )
  VALUES (
    p_episode_id, p_manifest_checksum, COALESCE(p_passed, false),
    COALESCE(p_blocker_count, 0), COALESCE(p_warning_count, 0),
    COALESCE(p_report, '{}'::jsonb), auth.uid()
  )
  ON CONFLICT (episode_id) DO UPDATE
  SET manifest_checksum = EXCLUDED.manifest_checksum,
      passed = EXCLUDED.passed,
      blocker_count = EXCLUDED.blocker_count,
      warning_count = EXCLUDED.warning_count,
      report = EXCLUDED.report,
      screened_by = EXCLUDED.screened_by,
      updated_at = now()
  RETURNING r.* INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_save_compliance_report(uuid, jsonb, boolean, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_compliance_report(uuid, jsonb, boolean, integer, integer, text) TO authenticated;

-- Takedowns --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.totp_episode_takedowns(p_episode_id uuid, p_active_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.totp_episode_takedowns t
  WHERE t.episode_id = p_episode_id
    AND (NOT COALESCE(p_active_only, true) OR t.active);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_episode_takedowns(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_episode_takedowns(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_record_takedown(
  p_episode_id uuid,
  p_performance_id uuid,
  p_action text,
  p_reason text,
  p_replacement_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_episode_takedowns;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A takedown needs a reason.';
  END IF;

  IF COALESCE(p_action, 'remove') NOT IN ('remove','replace','mute') THEN
    RAISE EXCEPTION 'Unknown takedown action.';
  END IF;

  INSERT INTO public.totp_episode_takedowns (
    episode_id, performance_id, action, reason, replacement_note, raised_by
  )
  VALUES (
    p_episode_id, p_performance_id, COALESCE(p_action, 'remove'), btrim(p_reason), p_replacement_note, auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_record_takedown(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_record_takedown(uuid, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_clear_takedown(p_takedown_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_episode_takedowns;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  UPDATE public.totp_episode_takedowns
  SET active = false, cleared_by = auth.uid(), cleared_at = now()
  WHERE id = p_takedown_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That takedown no longer exists.';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_clear_takedown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_admin_clear_takedown(uuid) TO authenticated;