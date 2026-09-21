CREATE OR REPLACE FUNCTION public.totp_episode_presenter_fragments(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_presenter_key text;
  v_phrases jsonb := '{}'::jsonb;
  v_bands jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT e.status::text, e.presenter_key::text
  INTO v_status, v_presenter_key
  FROM public.totp_episodes e
  WHERE e.id = p_episode_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object(
      'presenter_key', NULL,
      'phrases', '{}'::jsonb,
      'bands', '{}'::jsonb
    );
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin')
     AND v_status NOT IN ('broadcast', 'completed') THEN
    RETURN jsonb_build_object(
      'presenter_key', v_presenter_key,
      'phrases', '{}'::jsonb,
      'bands', '{}'::jsonb
    );
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(
      rows.phrase_id,
      jsonb_build_object(
        'storage_path', rows.storage_path,
        'uploaded_at', rows.uploaded_at
      )
    ),
    '{}'::jsonb
  )
  INTO v_phrases
  FROM (
    SELECT
      phrase_ids.phrase_id,
      object_row.name AS storage_path,
      COALESCE(object_row.updated_at, object_row.created_at) AS uploaded_at
    FROM unnest(ARRAY[
      'please-welcome',
      'up-next-its',
      'and-now-its',
      'time-for',
      'another-hit-from',
      'another-smash-from',
      'one-you-know-from',
      'studio-ready-for',
      'latest-entry-from',
      'brand-new-entry-from',
      'debut-its',
      'climbing-chart-its',
      'biggest-movers-its',
      'moving-up-its',
      'back-on-totp-its',
      'returning-studio-its',
      'still-riding-high-its',
      'straight-top-ten-its',
      'top-ten-this-week-its',
      'number-one-its',
      'still-number-one-its',
      'one-more-time-for',
      'make-some-noise-for',
      'give-it-up-for'
    ]::text[]) AS phrase_ids(phrase_id)
    JOIN LATERAL (
      SELECT o.name, o.created_at, o.updated_at
      FROM storage.objects o
      WHERE o.bucket_id = 'totp-media'
        AND o.name LIKE (
          'presenters/' || v_presenter_key || '/reusable-phrases/' ||
          phrase_ids.phrase_id || '-%'
        )
      ORDER BY COALESCE(o.updated_at, o.created_at) DESC NULLS LAST, o.name DESC
      LIMIT 1
    ) object_row ON true
  ) rows;

  SELECT COALESCE(
    jsonb_object_agg(
      rows.band_id::text,
      jsonb_build_object(
        'band_id', rows.band_id,
        'band_name', rows.band_name,
        'audio_url', rows.audio_url,
        'duration_ms', rows.duration_ms,
        'sha256', rows.sha256,
        'version', rows.version
      )
    ),
    '{}'::jsonb
  )
  INTO v_bands
  FROM (
    SELECT DISTINCT ON (b.id)
      b.id AS band_id,
      b.name::text AS band_name,
      a.audio_url,
      a.duration_ms,
      a.sha256,
      a.version
    FROM public.totp_performances p
    JOIN public.bands b ON b.id = p.band_id
    JOIN public.totp_band_name_audio a ON a.band_id = b.id
    WHERE p.episode_id = p_episode_id
      AND a.recorded_band_name = b.name::text
      AND NULLIF(trim(a.audio_url), '') IS NOT NULL
    ORDER BY b.id, a.version DESC, a.uploaded_at DESC
  ) rows;

  RETURN jsonb_build_object(
    'presenter_key', v_presenter_key,
    'phrases', v_phrases,
    'bands', v_bands
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_episode_presenter_fragments(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_episode_presenter_fragments(uuid)
TO authenticated;

COMMENT ON FUNCTION public.totp_episode_presenter_fragments(uuid) IS
  'Returns only current reusable presenter phrase paths and current band-name audio for bands in one TOTP episode. Non-admin callers receive data only after broadcast begins.';
