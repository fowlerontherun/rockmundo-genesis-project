CREATE TABLE IF NOT EXISTS public.totp_band_name_audio (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  recorded_band_name text NOT NULL,
  audio_url text NOT NULL,
  storage_path text NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms > 0),
  sha256 text NOT NULL CHECK (char_length(sha256) >= 32),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.totp_band_name_audio ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.totp_band_name_audio TO authenticated;
GRANT ALL ON public.totp_band_name_audio TO service_role;

DROP POLICY IF EXISTS "TOTP admins can view band name audio" ON public.totp_band_name_audio;
CREATE POLICY "TOTP admins can view band name audio"
ON public.totp_band_name_audio
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "TOTP admins can insert band name audio" ON public.totp_band_name_audio;
CREATE POLICY "TOTP admins can insert band name audio"
ON public.totp_band_name_audio
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "TOTP admins can update band name audio" ON public.totp_band_name_audio;
CREATE POLICY "TOTP admins can update band name audio"
ON public.totp_band_name_audio
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "TOTP admins can delete band name audio" ON public.totp_band_name_audio;
CREATE POLICY "TOTP admins can delete band name audio"
ON public.totp_band_name_audio
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS totp_band_name_audio_updated_at ON public.totp_band_name_audio;
CREATE TRIGGER totp_band_name_audio_updated_at
BEFORE UPDATE ON public.totp_band_name_audio
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.totp_admin_band_name_audio_catalog()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'band_id', rows.band_id,
        'band_name', rows.band_name,
        'created_at', rows.created_at,
        'is_solo_artist', rows.is_solo_artist,
        'status', rows.audio_status,
        'recorded_band_name', rows.recorded_band_name,
        'audio_url', rows.audio_url,
        'storage_path', rows.storage_path,
        'duration_ms', rows.duration_ms,
        'sha256', rows.sha256,
        'version', rows.version,
        'uploaded_at', rows.uploaded_at
      )
      ORDER BY
        CASE rows.audio_status WHEN 'missing' THEN 0 WHEN 'stale' THEN 1 ELSE 2 END,
        rows.created_at DESC NULLS LAST,
        lower(rows.band_name)
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      b.id AS band_id,
      b.name::text AS band_name,
      b.created_at,
      COALESCE(b.is_solo_artist, false) AS is_solo_artist,
      CASE
        WHEN a.band_id IS NULL THEN 'missing'
        WHEN a.recorded_band_name IS DISTINCT FROM b.name::text THEN 'stale'
        ELSE 'recorded'
      END AS audio_status,
      a.recorded_band_name,
      a.audio_url,
      a.storage_path,
      a.duration_ms,
      a.sha256,
      a.version,
      a.uploaded_at
    FROM public.bands b
    LEFT JOIN public.totp_band_name_audio a ON a.band_id = b.id
    WHERE b.status = 'active'
  ) rows;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_band_name_audio_catalog() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_band_name_audio_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_save_band_name_audio(
  p_band_id uuid,
  p_audio_url text,
  p_storage_path text,
  p_duration_ms integer,
  p_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band public.bands;
  v_audio public.totp_band_name_audio;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NULLIF(trim(p_audio_url), '') IS NULL
     OR NULLIF(trim(p_storage_path), '') IS NULL
     OR NULLIF(trim(p_sha256), '') IS NULL
     OR COALESCE(p_duration_ms, 0) <= 0 THEN
    RAISE EXCEPTION 'A valid recorded audio asset is required';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = p_band_id;
  IF v_band.id IS NULL THEN
    RAISE EXCEPTION 'Band not found';
  END IF;

  INSERT INTO public.totp_band_name_audio AS a (
    band_id,
    recorded_band_name,
    audio_url,
    storage_path,
    duration_ms,
    sha256,
    version,
    uploaded_by,
    uploaded_at
  ) VALUES (
    v_band.id,
    v_band.name::text,
    trim(p_audio_url),
    trim(p_storage_path),
    p_duration_ms,
    lower(trim(p_sha256)),
    1,
    auth.uid(),
    now()
  )
  ON CONFLICT (band_id) DO UPDATE
  SET recorded_band_name = EXCLUDED.recorded_band_name,
      audio_url = EXCLUDED.audio_url,
      storage_path = EXCLUDED.storage_path,
      duration_ms = EXCLUDED.duration_ms,
      sha256 = EXCLUDED.sha256,
      version = a.version + 1,
      uploaded_by = EXCLUDED.uploaded_by,
      uploaded_at = now(),
      updated_at = now()
  RETURNING a.* INTO v_audio;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now())
  WHERE n.user_id = auth.uid()
    AND n.metadata->>'notification_kind' = 'totp_band_name_audio_required'
    AND n.metadata->>'band_id' = p_band_id::text
    AND n.read_at IS NULL;

  RETURN jsonb_build_object(
    'band_id', v_band.id,
    'band_name', v_band.name::text,
    'created_at', v_band.created_at,
    'is_solo_artist', COALESCE(v_band.is_solo_artist, false),
    'status', 'recorded',
    'recorded_band_name', v_audio.recorded_band_name,
    'audio_url', v_audio.audio_url,
    'storage_path', v_audio.storage_path,
    'duration_ms', v_audio.duration_ms,
    'sha256', v_audio.sha256,
    'version', v_audio.version,
    'uploaded_at', v_audio.uploaded_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_save_band_name_audio(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_band_name_audio(uuid, text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins_totp_band_name_audio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_title text;
  v_message text;
  v_reason text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_title := 'New band needs presenter audio';
    v_message := format('Record the Top of the Pops band-name clip for %s.', NEW.name);
    v_reason := 'created';
  ELSE
    v_title := 'Band name audio needs updating';
    v_message := format('%s has been renamed to %s. Record a new Top of the Pops name clip.', OLD.name, NEW.name);
    v_reason := 'renamed';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    profile_id,
    category,
    type,
    title,
    message,
    action_path,
    metadata
  )
  SELECT
    ur.user_id,
    NULL,
    'system',
    'system',
    v_title,
    v_message,
    '/admin/top-of-the-pops#band-name-audio',
    jsonb_build_object(
      'notification_kind', 'totp_band_name_audio_required',
      'band_id', NEW.id,
      'band_name', NEW.name,
      'reason', v_reason,
      'actionable', true
    )
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = ur.user_id
        AND n.read_at IS NULL
        AND n.metadata->>'notification_kind' = 'totp_band_name_audio_required'
        AND n.metadata->>'band_id' = NEW.id::text
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_totp_band_name_audio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_admins_totp_band_name_audio ON public.bands;
CREATE TRIGGER notify_admins_totp_band_name_audio
AFTER INSERT OR UPDATE OF name ON public.bands
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_totp_band_name_audio();

COMMENT ON TABLE public.totp_band_name_audio IS
  'Admin-recorded immutable pronunciation/name clips for Top of the Pops presenter production. A row is stale when recorded_band_name differs from bands.name.';
COMMENT ON FUNCTION public.totp_admin_band_name_audio_catalog() IS
  'Admin-only Top of the Pops band-name recording work queue, with missing and stale recordings first.';
COMMENT ON FUNCTION public.totp_admin_save_band_name_audio(uuid, text, text, integer, text) IS
  'Admin-only save for a versioned Top of the Pops band-name audio clip; clears the acting admin notification.';
