-- Global, versioned crowd tuning defaults for the gig viewer.
-- Admins can promote settings from the demo; viewers can read the active singleton.

CREATE OR REPLACE FUNCTION public.normalize_gig_viewer_crowd_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_settings jsonb := COALESCE(p_settings, '{}'::jsonb);
  v_density numeric;
  v_depth numeric;
  v_lateral numeric;
  v_stage_pull numeric;
  v_randomness numeric;
  v_fan_scale numeric;
  v_arrival_speed numeric;
BEGIN
  IF jsonb_typeof(v_settings) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Crowd settings must be a JSON object' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_density := COALESCE((v_settings ->> 'densityMultiplier')::numeric, 2);
    v_depth := COALESCE((v_settings ->> 'depthSpread')::numeric, 1);
    v_lateral := COALESCE((v_settings ->> 'lateralSpread')::numeric, 1);
    v_stage_pull := COALESCE((v_settings ->> 'stagePull')::numeric, 0);
    v_randomness := COALESCE((v_settings ->> 'randomness')::numeric, 0);
    v_fan_scale := COALESCE((v_settings ->> 'fanScale')::numeric, 1);
    v_arrival_speed := COALESCE((v_settings ->> 'arrivalSpeed')::numeric, 1);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Crowd settings contain an invalid number' USING ERRCODE = '22023';
  END;

  IF v_density < 0.5 OR v_density > 4 THEN
    RAISE EXCEPTION 'densityMultiplier must be between 0.5 and 4';
  END IF;
  IF v_depth < 0.45 OR v_depth > 1.5 THEN
    RAISE EXCEPTION 'depthSpread must be between 0.45 and 1.5';
  END IF;
  IF v_lateral < 0.45 OR v_lateral > 1.5 THEN
    RAISE EXCEPTION 'lateralSpread must be between 0.45 and 1.5';
  END IF;
  IF v_stage_pull < 0 OR v_stage_pull > 1 THEN
    RAISE EXCEPTION 'stagePull must be between 0 and 1';
  END IF;
  IF v_randomness < 0 OR v_randomness > 0.8 THEN
    RAISE EXCEPTION 'randomness must be between 0 and 0.8';
  END IF;
  IF v_fan_scale < 0.6 OR v_fan_scale > 1.6 THEN
    RAISE EXCEPTION 'fanScale must be between 0.6 and 1.6';
  END IF;
  IF v_arrival_speed < 0.5 OR v_arrival_speed > 2 THEN
    RAISE EXCEPTION 'arrivalSpeed must be between 0.5 and 2';
  END IF;

  RETURN jsonb_build_object(
    'densityMultiplier', v_density,
    'depthSpread', v_depth,
    'lateralSpread', v_lateral,
    'stagePull', v_stage_pull,
    'randomness', v_randomness,
    'fanScale', v_fan_scale,
    'arrivalSpeed', v_arrival_speed
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.gig_viewer_crowd_settings (
  id boolean PRIMARY KEY DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  settings jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  reason text,
  CONSTRAINT gig_viewer_crowd_settings_singleton CHECK (id = true),
  CONSTRAINT gig_viewer_crowd_settings_valid CHECK (
    settings = public.normalize_gig_viewer_crowd_settings(settings)
  )
);

INSERT INTO public.gig_viewer_crowd_settings (id, revision, settings, reason)
VALUES (
  true,
  1,
  public.normalize_gig_viewer_crowd_settings('{}'::jsonb),
  'Initial production defaults'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.gig_viewer_crowd_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read gig viewer crowd settings" ON public.gig_viewer_crowd_settings;
CREATE POLICY "Authenticated users can read gig viewer crowd settings"
  ON public.gig_viewer_crowd_settings
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.gig_viewer_crowd_settings FROM anon, authenticated;
GRANT SELECT ON public.gig_viewer_crowd_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_gig_viewer_crowd_settings(
  p_settings jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_reason text := trim(COALESCE(p_reason, ''));
  v_previous jsonb;
  v_revision integer;
  v_updated_at timestamptz := timezone('utc', now());
  v_snapshotted integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF length(v_reason) < 8 THEN
    RAISE EXCEPTION 'A reason of at least 8 characters is required';
  END IF;

  v_settings := public.normalize_gig_viewer_crowd_settings(p_settings);

  SELECT settings, revision
  INTO v_previous, v_revision
  FROM public.gig_viewer_crowd_settings
  WHERE id = true
  FOR UPDATE;

  v_revision := COALESCE(v_revision, 0) + 1;

  INSERT INTO public.gig_viewer_crowd_settings AS current_settings (
    id, revision, settings, updated_by, updated_at, reason
  )
  VALUES (
    true, v_revision, v_settings, auth.uid(), v_updated_at, v_reason
  )
  ON CONFLICT (id) DO UPDATE
  SET revision = EXCLUDED.revision,
      settings = EXCLUDED.settings,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at,
      reason = EXCLUDED.reason;

  -- Give legacy ready replays a one-time snapshot. Replays that already carry
  -- a crowd tuning revision remain immutable and reproducible.
  UPDATE public.gig_viewer_replays
  SET event_payload = jsonb_set(
    jsonb_set(COALESCE(event_payload, '{}'::jsonb), '{crowdTuning}', v_settings, true),
    '{crowdTuningRevision}',
    to_jsonb(v_revision),
    true
  )
  WHERE generation_status = 'ready'
    AND jsonb_typeof(event_payload) = 'object'
    AND NOT (event_payload ? 'crowdTuningRevision');
  GET DIAGNOSTICS v_snapshotted = ROW_COUNT;

  INSERT INTO public.admin_action_audit (
    actor_user_id, action, target_table, target_id, metadata
  )
  VALUES (
    auth.uid(),
    'admin_set_gig_viewer_crowd_settings',
    'gig_viewer_crowd_settings',
    'global',
    jsonb_build_object(
      'reason', v_reason,
      'revision', v_revision,
      'previous_settings', v_previous,
      'new_settings', v_settings,
      'legacy_replays_snapshotted', v_snapshotted
    )
  );

  RETURN jsonb_build_object(
    'revision', v_revision,
    'settings', v_settings,
    'updatedAt', v_updated_at,
    'updatedBy', auth.uid(),
    'reason', v_reason,
    'legacyReplaysSnapshotted', v_snapshotted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_gig_viewer_crowd_settings(p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_gig_viewer_crowd_settings(
    public.normalize_gig_viewer_crowd_settings('{}'::jsonb),
    p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_gig_viewer_crowd_settings(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_gig_viewer_crowd_settings(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
