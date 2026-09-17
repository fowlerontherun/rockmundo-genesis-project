-- Public playback-safe audio resolver for genuine TOTP broadcasts.
-- Does not expose unreleased/pre-broadcast programme data.

CREATE OR REPLACE FUNCTION public.totp_public_performance_audio(p_performance_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN tp.id IS NULL THEN NULL::jsonb
    ELSE jsonb_build_object(
      'audio_url', coalesce(s.extended_audio_url, s.audio_url),
      'audio_generation_status', s.audio_generation_status,
      'duration_seconds', s.duration_seconds
    )
  END
  FROM (SELECT p_performance_id AS requested_id) input
  LEFT JOIN public.totp_performances tp ON tp.id = input.requested_id
  LEFT JOIN public.totp_episodes e ON e.id = tp.episode_id
  LEFT JOIN public.songs s ON s.id = tp.song_id
  WHERE tp.id IS NULL OR e.status IN ('broadcast', 'completed');
$$;

REVOKE ALL ON FUNCTION public.totp_public_performance_audio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_performance_audio(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.totp_public_performance_audio(uuid) IS
  'Returns the playable song recording only for a genuine Top of the Pops performance whose episode is on air or completed.';
