-- Session-specific checkpoints make "since last login" independent of the
-- profiles.last_login_at write on the index page, and safe across devices.
CREATE TABLE IF NOT EXISTS public.player_login_progress_snapshots (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  total_xp bigint NOT NULL DEFAULT 0,
  character_level integer NOT NULL DEFAULT 1,
  skills jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (profile_id, session_id)
);
CREATE INDEX IF NOT EXISTS player_login_progress_snapshots_recent_idx
  ON public.player_login_progress_snapshots (profile_id, captured_at DESC);

ALTER TABLE public.player_login_progress_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_login_progress_access ON public.player_login_progress_snapshots;
CREATE POLICY deny_direct_login_progress_access
  ON public.player_login_progress_snapshots
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.player_login_progress_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.player_login_progress_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.claim_login_progress_summary(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_session_id uuid;
  v_level integer;
  v_total_xp bigint := 0;
  v_skills jsonb := '{}'::jsonb;
  v_previous public.player_login_progress_snapshots%ROWTYPE;
  v_has_previous boolean := false;
  v_captured_at timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->>'session_id' IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  v_session_id := (auth.jwt()->>'session_id')::uuid;

  -- Locking the profile serializes two tabs claiming the same login.
  SELECT p.level INTO v_level
    FROM public.profiles p
   WHERE p.id = p_profile_id AND p.user_id = auth.uid()
     AND p.is_active IS TRUE AND p.died_at IS NULL AND p.deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'character_not_owned_or_inactive';
  END IF;

  -- A delayed request from an older device must not reset newer baselines.
  IF EXISTS (
    SELECT 1 FROM public.player_login_progress_snapshots s
    WHERE s.profile_id = p_profile_id AND s.session_id = v_session_id
  ) THEN
    RETURN jsonb_build_object('show', false);
  END IF;

  SELECT GREATEST(COALESCE(w.lifetime_xp, 0), COALESCE(w.skill_xp_lifetime, 0))
    INTO v_total_xp
    FROM public.player_xp_wallet w WHERE w.profile_id = p_profile_id;
  v_total_xp := GREATEST(COALESCE(v_total_xp, 0), 0);

  SELECT COALESCE(jsonb_object_agg(
    sp.skill_slug, jsonb_build_object(
      'level', GREATEST(COALESCE(sp.current_level, 0), 0),
      'xp', GREATEST(COALESCE(sp.current_xp, 0), 0),
      'required', GREATEST(COALESCE(sp.required_xp, 0), 0)
    )
  ), '{}'::jsonb)
    INTO v_skills FROM public.skill_progress sp WHERE sp.profile_id = p_profile_id;

  SELECT * INTO v_previous
    FROM public.player_login_progress_snapshots s WHERE s.profile_id = p_profile_id
   ORDER BY s.captured_at DESC, s.session_id DESC LIMIT 1;
  v_has_previous := FOUND;

  INSERT INTO public.player_login_progress_snapshots
    (profile_id, session_id, captured_at, total_xp, character_level, skills)
  VALUES (p_profile_id, v_session_id, v_captured_at, v_total_xp, COALESCE(v_level, 1), v_skills);

  RETURN jsonb_build_object(
    'show', true, 'session_id', v_session_id, 'first_login', NOT v_has_previous,
    'previous', CASE WHEN v_has_previous THEN jsonb_build_object(
      'total_xp', v_previous.total_xp, 'level', v_previous.character_level,
      'skills', v_previous.skills, 'captured_at', v_previous.captured_at
    ) ELSE 'null'::jsonb END,
    'current', jsonb_build_object(
      'total_xp', v_total_xp, 'level', COALESCE(v_level, 1),
      'skills', v_skills, 'captured_at', v_captured_at
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_login_progress_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_login_progress_summary(uuid) TO authenticated;
