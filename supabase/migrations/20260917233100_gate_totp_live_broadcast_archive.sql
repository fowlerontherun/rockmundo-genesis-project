-- Prevent viewers from skipping ahead through frozen Top of the Pops replays while an episode is live.
-- The immutable archive is still built at broadcast start, but public viewers only receive acts whose
-- scheduled airtime has been reached. Completed episodes expose the full archive as before.

CREATE OR REPLACE FUNCTION public.totp_public_broadcast_archive(p_episode_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_rows jsonb;
  v_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  END IF;

  IF p_episode_id IS NULL THEN
    SELECT * INTO v_episode
    FROM public.totp_episodes
    WHERE status <> 'cancelled'
      AND broadcast_at <= now()
    ORDER BY broadcast_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_episode
    FROM public.totp_episodes
    WHERE id = p_episode_id;
  END IF;

  IF v_episode.id IS NULL THEN
    RETURN jsonb_build_object('episode_id', NULL, 'replays', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', visible.id,
      'performance_id', visible.performance_id,
      'replay_version', visible.replay_version,
      'stage_key', visible.stage_key,
      'presenter_key', visible.presenter_key,
      'duration_ms', visible.duration_ms,
      'checksum', visible.checksum,
      'generated_at', visible.generated_at,
      'payload', visible.payload
    ) ORDER BY visible.running_order), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      r.*,
      (r.payload->>'runningOrder')::integer AS running_order,
      coalesce(
        sum(r.duration_ms + 12000) OVER (
          PARTITION BY r.episode_id
          ORDER BY (r.payload->>'runningOrder')::integer
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      ) AS prior_programme_ms
    FROM public.totp_broadcast_replays r
    WHERE r.episode_id = v_episode.id
  ) visible
  WHERE
    v_is_admin
    OR v_episode.status = 'completed'
    OR (
      v_episode.status = 'broadcast'
      AND now() >= v_episode.broadcast_at + make_interval(secs => ((20000 + visible.prior_programme_ms) / 1000)::integer)
    );

  RETURN jsonb_build_object('episode_id', v_episode.id, 'replays', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_public_broadcast_archive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_broadcast_archive(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.totp_public_broadcast_archive(uuid) IS
  'Returns immutable TOTP replays. During a live broadcast, non-admin viewers only receive acts once their scheduled airtime has been reached; completed episodes expose the full archive.';
