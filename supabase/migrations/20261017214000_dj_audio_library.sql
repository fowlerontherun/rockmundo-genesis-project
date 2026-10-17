-- DJ audio library: rights-cleared admin uploads plus explicit game-song opt-in.
-- This original migration had not been applied at the time of the 2026-10-17 audit.
-- Historical DJ payouts are unaffected. Free mixing practice never grants rewards.

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS dj_use_allowed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.songs.dj_use_allowed IS
  'Creator opt-in for other DJs to play recorded or released music; own practice needs no opt-in.';

-- Existing band-song UPDATE RLS lets collaborators update band songs. Only the
-- original auth-level song owner (or an admin) may change this *consent* field.
CREATE OR REPLACE FUNCTION public.guard_song_dj_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.dj_use_allowed IS DISTINCT FROM OLD.dj_use_allowed
     AND NOT (
       OLD.user_id = (SELECT auth.uid())
       OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
       OR current_user IN ('postgres', 'service_role')
     ) THEN
    RAISE EXCEPTION 'Only the original song owner may change DJ use consent'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_song_dj_consent() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_song_dj_consent_on_songs ON public.songs;
CREATE TRIGGER guard_song_dj_consent_on_songs
  BEFORE UPDATE OF dj_use_allowed ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.guard_song_dj_consent();

CREATE TABLE IF NOT EXISTS public.dj_audio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  artist text NOT NULL CHECK (length(btrim(artist)) BETWEEN 1 AND 200),
  genre text NOT NULL DEFAULT 'Electronic' CHECK (length(btrim(genre)) BETWEEN 1 AND 100),
  bpm integer CHECK (bpm BETWEEN 40 AND 240),
  musical_key text CHECK (musical_key IS NULL OR length(musical_key) <= 12),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 7200),
  storage_path text NOT NULL UNIQUE CHECK (
    storage_path ~ '^catalog/[a-f0-9-]{36}/[a-zA-Z0-9_-]+[.](mp3|m4a|ogg|wav|webm)$'
  ),
  rights_confirmed boolean NOT NULL DEFAULT false,
  rights_notes text,
  is_active boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_audio_tracks_publish_rights CHECK (
    NOT is_active OR
    (rights_confirmed AND length(btrim(coalesce(rights_notes, ''))) > 0)
  )
);

ALTER TABLE public.dj_audio_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated DJs can view published cleared audio" ON public.dj_audio_tracks;
CREATE POLICY "Authenticated DJs can view published cleared audio"
  ON public.dj_audio_tracks FOR SELECT TO authenticated
  USING (
    (is_active AND rights_confirmed)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins insert DJ audio tracks" ON public.dj_audio_tracks;
CREATE POLICY "Admins insert DJ audio tracks"
  ON public.dj_audio_tracks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND uploaded_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Admins update DJ audio tracks" ON public.dj_audio_tracks;
CREATE POLICY "Admins update DJ audio tracks"
  ON public.dj_audio_tracks FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete DJ audio tracks" ON public.dj_audio_tracks;
CREATE POLICY "Admins delete DJ audio tracks"
  ON public.dj_audio_tracks FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_audio_tracks TO authenticated;

-- Private media, not the public legacy practice-tracks bucket.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dj-tracks', 'dj-tracks', false, 52428800,
  ARRAY['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a',
        'audio/ogg','audio/wav','audio/x-wav','audio/webm']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Cleared DJ audio storage read" ON storage.objects;
CREATE POLICY "Cleared DJ audio storage read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dj-tracks'
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.dj_audio_tracks AS t
        WHERE t.storage_path = storage.objects.name
          AND t.is_active AND t.rights_confirmed
      )
    )
  );

DROP POLICY IF EXISTS "Admin-only DJ audio storage insert" ON storage.objects;
CREATE POLICY "Admin-only DJ audio storage insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admin-only DJ audio storage update" ON storage.objects;
CREATE POLICY "Admin-only DJ audio storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admin-only DJ audio storage delete" ON storage.objects;
CREATE POLICY "Admin-only DJ audio storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS dj_audio_tracks_active_idx
  ON public.dj_audio_tracks(is_active, genre) WHERE rights_confirmed;

-- Fix existing practice tracks: the AdminRoute UI is insufficient.
-- Keep public read, but require actual administrator status for all writes.
ALTER TABLE public.practice_track_audio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated insert practice track audio" ON public.practice_track_audio;
DROP POLICY IF EXISTS "Authenticated update practice track audio" ON public.practice_track_audio;
DROP POLICY IF EXISTS "Authenticated delete practice track audio" ON public.practice_track_audio;

CREATE POLICY "Admins insert practice track audio"
  ON public.practice_track_audio FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY "Admins update practice track audio"
  ON public.practice_track_audio FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY "Admins delete practice track audio"
  ON public.practice_track_audio FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated upload practice tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update practice tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete practice tracks" ON storage.objects;

CREATE POLICY "Admins upload practice tracks"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'practice-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY "Admins update practice tracks"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'practice-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'practice-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
CREATE POLICY "Admins delete practice tracks"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'practice-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
