-- DJ audio library: server-authorized admin uploads and opt-in game songs.
-- DJ performances are still settled independently; this catalogue grants no rewards.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS dj_use_allowed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.songs.dj_use_allowed IS
  'Owner opt-in for other DJs to play this released song; own playable songs need no opt-in.';

CREATE TABLE IF NOT EXISTS public.dj_audio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  artist text NOT NULL CHECK (length(btrim(artist)) BETWEEN 1 AND 200),
  genre text NOT NULL DEFAULT 'Electronic' CHECK (length(btrim(genre)) BETWEEN 1 AND 100),
  bpm integer CHECK (bpm BETWEEN 40 AND 240),
  musical_key text CHECK (musical_key IS NULL OR length(musical_key) <= 12),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 7200),
  storage_path text NOT NULL UNIQUE CHECK (storage_path ~ '^catalog/[a-f0-9-]{36}/[a-zA-Z0-9_-]+[.](mp3|m4a|ogg|wav|webm)),
  rights_confirmed boolean NOT NULL DEFAULT false,
  rights_notes text,
  is_active boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_audio_tracks_publish_rights CHECK (NOT is_active OR rights_confirmed)
);

ALTER TABLE public.dj_audio_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated DJs can view published cleared audio"
  ON public.dj_audio_tracks FOR SELECT TO authenticated
  USING ((is_active AND rights_confirmed) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins insert DJ audio tracks"
  ON public.dj_audio_tracks FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND uploaded_by = (SELECT auth.uid()));

CREATE POLICY "Admins update DJ audio tracks"
  ON public.dj_audio_tracks FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins delete DJ audio tracks"
  ON public.dj_audio_tracks FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_audio_tracks TO authenticated;

-- Private bucket: users can only sign/read published cleared tracks, admins may manage objects.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dj-tracks', 'dj-tracks', false, 52428800,
        ARRAY['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/ogg','audio/wav','audio/x-wav','audio/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Cleared DJ audio storage read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dj-tracks' AND
    (public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
     OR EXISTS (
        SELECT 1 FROM public.dj_audio_tracks t
        WHERE t.storage_path = storage.objects.name
          AND t.is_active AND t.rights_confirmed
     )));

CREATE POLICY "Admin-only DJ audio storage insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admin-only DJ audio storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admin-only DJ audio storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS dj_audio_tracks_active_idx
  ON public.dj_audio_tracks(is_active, genre) WHERE rights_confirmed;
),
  rights_confirmed boolean NOT NULL DEFAULT false,
  rights_notes text,
  is_active boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_audio_tracks_publish_rights CHECK (NOT is_active OR rights_confirmed)
);

ALTER TABLE public.dj_audio_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated DJs can view published cleared audio"
  ON public.dj_audio_tracks FOR SELECT TO authenticated
  USING ((is_active AND rights_confirmed) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins insert DJ audio tracks"
  ON public.dj_audio_tracks FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND uploaded_by = (SELECT auth.uid()));

CREATE POLICY "Admins update DJ audio tracks"
  ON public.dj_audio_tracks FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins delete DJ audio tracks"
  ON public.dj_audio_tracks FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_audio_tracks TO authenticated;

-- Private bucket: users can only sign/read published cleared tracks, admins may manage objects.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dj-tracks', 'dj-tracks', false, 52428800,
        ARRAY['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/ogg','audio/wav','audio/x-wav','audio/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Cleared DJ audio storage read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dj-tracks' AND
    (public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
     OR EXISTS (
        SELECT 1 FROM public.dj_audio_tracks t
        WHERE t.storage_path = storage.objects.name
          AND t.is_active AND t.rights_confirmed
     )));

CREATE POLICY "Admin-only DJ audio storage insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admin-only DJ audio storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admin-only DJ audio storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dj-tracks'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS dj_audio_tracks_active_idx
  ON public.dj_audio_tracks(is_active, genre) WHERE rights_confirmed;
