CREATE TABLE IF NOT EXISTS public.totp_youtube_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  manifest_checksum text,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','uploading','scheduled','published','failed')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  privacy_status text NOT NULL DEFAULT 'private' CHECK (privacy_status IN ('private','unlisted','public')),
  publish_at timestamptz,
  source_url text,
  video_id text,
  watch_url text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_youtube_publications_episode_idx ON public.totp_youtube_publications(episode_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.totp_youtube_publications TO authenticated;
GRANT ALL ON public.totp_youtube_publications TO service_role;

ALTER TABLE public.totp_youtube_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage totp youtube publications" ON public.totp_youtube_publications;
CREATE POLICY "Admins manage totp youtube publications"
ON public.totp_youtube_publications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.totp_admin_youtube_publications(p_episode_id uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS SETOF public.totp_youtube_publications
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.totp_youtube_publications
  WHERE public.has_role(auth.uid(), 'admin')
    AND (p_episode_id IS NULL OR episode_id = p_episode_id)
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_save_youtube_publication(
  p_episode_id uuid,
  p_title text,
  p_description text DEFAULT '',
  p_tags text[] DEFAULT '{}',
  p_privacy_status text DEFAULT 'private',
  p_publish_at timestamptz DEFAULT NULL,
  p_source_url text DEFAULT NULL,
  p_manifest_checksum text DEFAULT NULL,
  p_id uuid DEFAULT NULL
)
RETURNS public.totp_youtube_publications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_youtube_publications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can plan a Top of the Pops upload.';
  END IF;
  IF coalesce(btrim(p_title), '') = '' THEN
    RAISE EXCEPTION 'The episode needs a video title before it can be uploaded.';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.totp_youtube_publications
    SET title = btrim(p_title),
        description = coalesce(p_description, ''),
        tags = coalesce(p_tags, '{}'),
        privacy_status = p_privacy_status,
        publish_at = p_publish_at,
        source_url = nullif(btrim(coalesce(p_source_url, '')), ''),
        manifest_checksum = p_manifest_checksum,
        error_message = NULL,
        updated_at = now()
    WHERE id = p_id
      AND state IN ('draft','failed')
    RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'That upload can no longer be edited.';
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.totp_youtube_publications (
    episode_id, title, description, tags, privacy_status, publish_at, source_url, manifest_checksum, created_by
  ) VALUES (
    p_episode_id, btrim(p_title), coalesce(p_description, ''), coalesce(p_tags, '{}'),
    p_privacy_status, p_publish_at, nullif(btrim(coalesce(p_source_url, '')), ''), p_manifest_checksum, auth.uid()
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_delete_youtube_publication(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can remove a planned upload.';
  END IF;
  DELETE FROM public.totp_youtube_publications WHERE id = p_id AND state IN ('draft','failed');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_set_youtube_publication_state(
  p_id uuid,
  p_state text,
  p_video_id text DEFAULT NULL,
  p_watch_url text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS public.totp_youtube_publications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_youtube_publications;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Not allowed to update this upload.';
  END IF;
  UPDATE public.totp_youtube_publications
  SET state = p_state,
      video_id = COALESCE(p_video_id, video_id),
      watch_url = COALESCE(p_watch_url, watch_url),
      error_message = p_error_message,
      updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Upload not found.';
  END IF;
  RETURN v_row;
END;
$$;