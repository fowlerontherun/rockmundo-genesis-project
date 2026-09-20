CREATE OR REPLACE FUNCTION public.totp_episode_presenter_audio(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_audio jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT e.status::text, pl.presenter_audio
  INTO v_status, v_audio
  FROM public.totp_episodes e
  LEFT JOIN public.totp_episode_plans pl ON pl.episode_id = e.id
  WHERE e.id = p_episode_id;

  IF v_status IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin')
     AND v_status NOT IN ('broadcast', 'completed') THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN COALESCE(v_audio, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_episode_presenter_audio(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_episode_presenter_audio(uuid) TO authenticated;

COMMENT ON FUNCTION public.totp_episode_presenter_audio(uuid) IS
  'Returns only versioned presenter audio metadata for admins or aired Top of the Pops episodes; does not expose episode production notes or rights data.';
