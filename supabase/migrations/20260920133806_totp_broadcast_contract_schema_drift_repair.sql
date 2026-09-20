-- Repair live schema drift: Phase 0 broadcast-contract columns were present in the
-- repository migration history but absent from the production database. Keep this
-- idempotent so environments that already applied Phase 0 remain unchanged.

ALTER TABLE public.totp_episode_plans
  ADD COLUMN IF NOT EXISTS broadcast_rights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS presenter_audio jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.totp_episode_plans.broadcast_rights IS
  'Episode-scoped external broadcast rights keyed by song UUID. No track is cleared implicitly.';
COMMENT ON COLUMN public.totp_episode_plans.presenter_audio IS
  'Versioned recorded presenter assets keyed by production cue/performance id, including script checksum, media SHA-256 and duration.';

CREATE OR REPLACE FUNCTION public.totp_admin_save_episode_plan(p_episode_id uuid, p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_episode_plans;
  v_rights jsonb := COALESCE(p_plan->'broadcast_rights', '{}'::jsonb);
  v_presenter_audio jsonb := COALESCE(p_plan->'presenter_audio', '{}'::jsonb);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can save an episode plan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.totp_episodes WHERE id = p_episode_id) THEN
    RAISE EXCEPTION 'Episode not found';
  END IF;

  IF jsonb_typeof(v_rights) <> 'object' THEN
    RAISE EXCEPTION 'broadcast_rights must be a JSON object keyed by song id';
  END IF;
  IF jsonb_typeof(v_presenter_audio) <> 'object' THEN
    RAISE EXCEPTION 'presenter_audio must be a JSON object keyed by production cue/performance id';
  END IF;

  INSERT INTO public.totp_episode_plans AS pl (
    episode_id, theme, opening_link, closing_link, segments, notes,
    broadcast_rights, presenter_audio, updated_by
  ) VALUES (
    p_episode_id,
    NULLIF(p_plan->>'theme', ''),
    NULLIF(p_plan->>'opening_link', ''),
    NULLIF(p_plan->>'closing_link', ''),
    COALESCE(p_plan->'segments', '[]'::jsonb),
    NULLIF(p_plan->>'notes', ''),
    v_rights,
    v_presenter_audio,
    auth.uid()
  )
  ON CONFLICT (episode_id) DO UPDATE
  SET theme = EXCLUDED.theme,
      opening_link = EXCLUDED.opening_link,
      closing_link = EXCLUDED.closing_link,
      segments = EXCLUDED.segments,
      notes = EXCLUDED.notes,
      broadcast_rights = EXCLUDED.broadcast_rights,
      presenter_audio = EXCLUDED.presenter_audio,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING pl.* INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_save_episode_plan(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_episode_plan(uuid, jsonb) TO authenticated;
