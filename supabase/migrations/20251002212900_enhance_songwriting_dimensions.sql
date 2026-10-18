BEGIN;

-- Catalog of supported songwriting genres for richer classification
CREATE TABLE IF NOT EXISTS public.song_genre_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Organized list of song purposes (e.g. single, sync brief, pitch demo)
CREATE TABLE IF NOT EXISTS public.song_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  focus_area text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Writing modes help teams coordinate the collaborative flow
CREATE TABLE IF NOT EXISTS public.song_writing_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_collaborative boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.song_genre_catalog (slug, display_name, description)
VALUES
  ('pop', 'Pop', 'Contemporary popular music with broad appeal.'),
  ('rock', 'Rock', 'Guitar-driven music spanning classic to modern styles.'),
  ('hip_hop', 'Hip-Hop', 'Rhythmic lyric-driven music and beat production.'),
  ('edm', 'Electronic / Dance', 'Club-focused electronic production and songwriting.'),
  ('singer_songwriter', 'Singer-Songwriter', 'Acoustic and storytelling-forward works.'),
  ('soul_rnb', 'Soul / R&B', 'Groove-led songwriting with vocal focus.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.song_purposes (slug, label, description, focus_area)
VALUES
  ('artist_single', 'Artist Single', 'Lead artist single intended for a wide release.', 'release'),
  ('sync_pitch', 'Sync Pitch', 'Tailored pitch for film, TV, or advertising briefs.', 'licensing'),
  ('aandr_showcase', 'A&R Showcase', 'Demo geared toward label and publisher meetings.', 'industry'),
  ('fan_exclusive', 'Fan Exclusive', 'Exclusive drop for superfans and community supporters.', 'community'),
  ('writing_camp', 'Writing Camp Deliverable', 'Collaborative deliverable from a writing retreat or camp.', 'collaboration')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.song_writing_modes (slug, label, description, is_collaborative)
VALUES
  ('solo_focus', 'Solo Focus', 'Single writer crafting ideas independently.', false),
  ('co_write', 'Co-Write', 'Two or more writers splitting sections or duties.', true),
  ('topline_session', 'Topline Session', 'Writer focusing on lyrics and melody over existing track.', true),
  ('production_lab', 'Production Lab', 'Producer-led experimentation generating hooks and motifs.', true),
  ('band_room', 'Band Room', 'Live room writing with full band iteration.', true)
ON CONFLICT (slug) DO NOTHING;

-- New collaborative metadata for songwriting projects
ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS genre_id uuid REFERENCES public.song_genre_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS genre_familiarity numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS song_purpose_id uuid REFERENCES public.song_purposes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS writing_mode_id uuid REFERENCES public.song_writing_modes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lyrics_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS melody_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rhythm_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arrangement_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_potential integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS song_rating integer NOT NULL DEFAULT 0;

UPDATE public.songwriting_projects
SET
  genre_familiarity = COALESCE(genre_familiarity, 0),
  lyrics_quality = COALESCE(lyrics_quality, 0),
  melody_quality = COALESCE(melody_quality, 0),
  rhythm_quality = COALESCE(rhythm_quality, 0),
  arrangement_quality = COALESCE(arrangement_quality, 0),
  production_potential = COALESCE(production_potential, 0),
  song_rating = COALESCE(song_rating, 0);

ALTER TABLE public.songwriting_projects
  ALTER COLUMN genre_familiarity SET NOT NULL,
  ALTER COLUMN genre_familiarity SET DEFAULT 0,
  ADD CONSTRAINT songwriting_projects_genre_familiarity_check
    CHECK (genre_familiarity >= 0 AND genre_familiarity <= 100),
  ADD CONSTRAINT songwriting_projects_lyrics_quality_check
    CHECK (lyrics_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songwriting_projects_melody_quality_check
    CHECK (melody_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songwriting_projects_rhythm_quality_check
    CHECK (rhythm_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songwriting_projects_arrangement_quality_check
    CHECK (arrangement_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songwriting_projects_production_potential_check
    CHECK (production_potential BETWEEN 0 AND 1000),
  ADD CONSTRAINT songwriting_projects_song_rating_check
    CHECK (song_rating BETWEEN 0 AND 1000);

CREATE INDEX IF NOT EXISTS songwriting_projects_genre_id_idx
  ON public.songwriting_projects (genre_id);
CREATE INDEX IF NOT EXISTS songwriting_projects_song_purpose_idx
  ON public.songwriting_projects (song_purpose_id);
CREATE INDEX IF NOT EXISTS songwriting_projects_writing_mode_idx
  ON public.songwriting_projects (writing_mode_id);

-- Mirror the new analytics columns on finished songs
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS genre_id uuid REFERENCES public.song_genre_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS genre_familiarity numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS song_purpose_id uuid REFERENCES public.song_purposes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS writing_mode_id uuid REFERENCES public.song_writing_modes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lyrics_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS melody_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rhythm_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arrangement_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_potential integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS song_rating integer NOT NULL DEFAULT 0;

UPDATE public.songs
SET
  genre_familiarity = COALESCE(genre_familiarity, 0),
  lyrics_quality = COALESCE(lyrics_quality, 0),
  melody_quality = COALESCE(melody_quality, 0),
  rhythm_quality = COALESCE(rhythm_quality, 0),
  arrangement_quality = COALESCE(arrangement_quality, 0),
  production_potential = COALESCE(production_potential, 0),
  song_rating = COALESCE(song_rating, 0);

ALTER TABLE public.songs
  ALTER COLUMN genre_familiarity SET NOT NULL,
  ALTER COLUMN genre_familiarity SET DEFAULT 0,
  ADD CONSTRAINT songs_genre_familiarity_check
    CHECK (genre_familiarity >= 0 AND genre_familiarity <= 100),
  ADD CONSTRAINT songs_lyrics_quality_check
    CHECK (lyrics_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songs_melody_quality_check
    CHECK (melody_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songs_rhythm_quality_check
    CHECK (rhythm_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songs_arrangement_quality_check
    CHECK (arrangement_quality BETWEEN 0 AND 1000),
  ADD CONSTRAINT songs_production_potential_check
    CHECK (production_potential BETWEEN 0 AND 1000),
  ADD CONSTRAINT songs_song_rating_check
    CHECK (song_rating BETWEEN 0 AND 1000);

CREATE INDEX IF NOT EXISTS songs_genre_id_idx
  ON public.songs (genre_id);
CREATE INDEX IF NOT EXISTS songs_song_purpose_idx
  ON public.songs (song_purpose_id);
CREATE INDEX IF NOT EXISTS songs_writing_mode_idx
  ON public.songs (writing_mode_id);

-- Track collaborators and session contributors with royalty splits
CREATE TABLE IF NOT EXISTS public.songwriting_project_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text,
  royalty_split numeric(5,2) NOT NULL DEFAULT 0,
  contribution_scope text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT songwriting_project_collaborators_split_check
    CHECK (royalty_split >= 0 AND royalty_split <= 100),
  CONSTRAINT songwriting_project_collaborators_unique_member
    UNIQUE (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS songwriting_project_collaborators_project_idx
  ON public.songwriting_project_collaborators (project_id);
CREATE INDEX IF NOT EXISTS songwriting_project_collaborators_profile_idx
  ON public.songwriting_project_collaborators (profile_id);

ALTER TABLE public.songwriting_project_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project collaborators readable by owners and members"
  ON public.songwriting_project_collaborators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.songwriting_projects p
      WHERE p.id = songwriting_project_collaborators.project_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = songwriting_project_collaborators.profile_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Project collaborators manageable by project owner"
  ON public.songwriting_project_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.songwriting_projects p
      WHERE p.id = songwriting_project_collaborators.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.songwriting_projects p
      WHERE p.id = songwriting_project_collaborators.project_id
        AND p.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.songwriting_session_contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.songwriting_sessions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text,
  royalty_split numeric(5,2) NOT NULL DEFAULT 0,
  minutes_participated integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT songwriting_session_contributors_split_check
    CHECK (royalty_split >= 0 AND royalty_split <= 100),
  CONSTRAINT songwriting_session_contributors_minutes_check
    CHECK (minutes_participated >= 0),
  CONSTRAINT songwriting_session_contributors_unique_member
    UNIQUE (session_id, profile_id)
);

CREATE INDEX IF NOT EXISTS songwriting_session_contributors_session_idx
  ON public.songwriting_session_contributors (session_id);
CREATE INDEX IF NOT EXISTS songwriting_session_contributors_project_idx
  ON public.songwriting_session_contributors (project_id);
CREATE INDEX IF NOT EXISTS songwriting_session_contributors_profile_idx
  ON public.songwriting_session_contributors (profile_id);

ALTER TABLE public.songwriting_session_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session contributors readable by owners and members"
  ON public.songwriting_session_contributors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.songwriting_projects p
      WHERE p.id = songwriting_session_contributors.project_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = songwriting_session_contributors.profile_id
        AND pr.user_id = auth.uid()
    )
  );

CREATE POLICY "Session contributors manageable by project owner"
  ON public.songwriting_session_contributors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.songwriting_projects p
      WHERE p.id = songwriting_session_contributors.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.songwriting_projects p
      WHERE p.id = songwriting_session_contributors.project_id
        AND p.user_id = auth.uid()
    )
  );

-- Richer songwriting progression calculation accounting for the new fields
CREATE OR REPLACE FUNCTION public.calculate_songwriting_progress(
  p_skill_songwriting INTEGER,
  p_skill_creativity INTEGER,
  p_skill_composition INTEGER,
  p_skill_vocals INTEGER,
  p_skill_instrumental INTEGER,
  p_attr_creative_insight INTEGER,
  p_attr_musical_ability INTEGER,
  p_attr_rhythm_sense INTEGER,
  p_current_music INTEGER,
  p_current_lyrics INTEGER,
  p_current_lyrics_quality INTEGER,
  p_current_melody_quality INTEGER,
  p_current_rhythm_quality INTEGER,
  p_current_arrangement_quality INTEGER,
  p_current_production_potential INTEGER,
  p_current_song_rating INTEGER,
  p_genre_familiarity NUMERIC,
  p_mood_state NUMERIC,
  p_health INTEGER,
  p_inspiration NUMERIC
) RETURNS JSONB AS $$
DECLARE
  max_progress CONSTANT INTEGER := 2000;
  max_quality CONSTANT INTEGER := 1000;
  base_random NUMERIC := 0.30 + (random() * 0.20);
  songwriting_skill_avg NUMERIC := (
    COALESCE(p_skill_songwriting, 1) +
    COALESCE(p_skill_creativity, 1) +
    COALESCE(p_skill_composition, 1)
  ) / 3.0;
  performance_skill_avg NUMERIC := (
    COALESCE(p_skill_vocals, 1) +
    COALESCE(p_skill_instrumental, 1)
  ) / 2.0;
  attribute_avg NUMERIC := (
    COALESCE(p_attr_creative_insight, 10) +
    COALESCE(p_attr_musical_ability, 10) +
    COALESCE(p_attr_rhythm_sense, 10)
  ) / 3.0;
  health_score NUMERIC := LEAST(100, GREATEST(0, COALESCE(p_health, 70)));
  mood_value NUMERIC := LEAST(100, GREATEST(0, COALESCE(p_mood_state, 60)));
  inspiration_value NUMERIC := LEAST(100, GREATEST(0, COALESCE(p_inspiration, 55)));
  familiarity_value NUMERIC := LEAST(100, GREATEST(0, COALESCE(p_genre_familiarity, 0)));
  mood_modifier NUMERIC := 0.85 + (mood_value / 100.0) * 0.30;
  health_modifier NUMERIC := 0.80 + (health_score / 100.0) * 0.40;
  inspiration_modifier NUMERIC := 0.90 + (inspiration_value / 100.0) * 0.50;
  familiarity_modifier NUMERIC := 0.80 + (familiarity_value / 100.0) * 0.40;
  skill_modifier NUMERIC := 1 + (songwriting_skill_avg / 120.0);
  performance_modifier NUMERIC := 1 + (performance_skill_avg / 150.0);
  attribute_modifier NUMERIC := 1 + (attribute_avg / 200.0);
  combined_modifier NUMERIC :=
    skill_modifier *
    performance_modifier *
    attribute_modifier *
    mood_modifier *
    health_modifier *
    inspiration_modifier *
    familiarity_modifier;
  remaining_music INTEGER := GREATEST(0, max_progress - COALESCE(p_current_music, 0));
  remaining_lyrics INTEGER := GREATEST(0, max_progress - COALESCE(p_current_lyrics, 0));
  total_remaining INTEGER := remaining_music + remaining_lyrics;
  base_total NUMERIC := 0;
  total_gain INTEGER := 0;
  music_share NUMERIC := 0.5;
  music_gain INTEGER := 0;
  lyrics_gain INTEGER := 0;
  quality_base NUMERIC := 0;
  lyrics_quality_gain INTEGER := 0;
  melody_quality_gain INTEGER := 0;
  rhythm_quality_gain INTEGER := 0;
  arrangement_quality_gain INTEGER := 0;
  production_potential_gain INTEGER := 0;
  song_rating_gain INTEGER := 0;
  xp_earned INTEGER := 0;
  quality_progress_factor NUMERIC := 0;
  progress_ratio NUMERIC := 0;
BEGIN
  IF total_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'music_gain', 0,
      'lyrics_gain', 0,
      'lyrics_quality_gain', 0,
      'melody_quality_gain', 0,
      'rhythm_quality_gain', 0,
      'arrangement_quality_gain', 0,
      'production_potential_gain', 0,
      'song_rating_gain', 0,
      'xp_earned', 0,
      'modifiers', jsonb_build_object(
        'skill', skill_modifier,
        'performance', performance_modifier,
        'attributes', attribute_modifier,
        'mood', mood_modifier,
        'health', health_modifier,
        'inspiration', inspiration_modifier,
        'familiarity', familiarity_modifier
      )
    );
  END IF;

  base_total := total_remaining * base_random;
  base_total := base_total * combined_modifier;
  base_total := GREATEST(60, LEAST(total_remaining, FLOOR(base_total)));

  IF remaining_music = 0 THEN
    music_share := 0;
  ELSIF remaining_lyrics = 0 THEN
    music_share := 1;
  ELSE
    music_share := (remaining_music::NUMERIC / total_remaining);
    music_share := LEAST(0.75, GREATEST(0.25, music_share + ((random() - 0.5) * 0.15)));
  END IF;

  total_gain := FLOOR(base_total);
  music_gain := LEAST(remaining_music, FLOOR(total_gain * music_share));
  lyrics_gain := LEAST(remaining_lyrics, total_gain - music_gain);

  quality_progress_factor := (songwriting_skill_avg + performance_skill_avg + attribute_avg) / 3.0;
  progress_ratio := LEAST(1.0, (COALESCE(p_current_song_rating, 0)::NUMERIC + 200) / (max_quality + 200));
  quality_base := GREATEST(8, FLOOR((quality_progress_factor / 8.0) * combined_modifier * (1.1 - progress_ratio)));

  lyrics_quality_gain := LEAST(max_quality - COALESCE(p_current_lyrics_quality, 0), FLOOR(quality_base * 1.10));
  melody_quality_gain := LEAST(max_quality - COALESCE(p_current_melody_quality, 0), FLOOR(quality_base * 1.05));
  rhythm_quality_gain := LEAST(max_quality - COALESCE(p_current_rhythm_quality, 0), FLOOR(quality_base));
  arrangement_quality_gain := LEAST(max_quality - COALESCE(p_current_arrangement_quality, 0), FLOOR(quality_base * 0.95));
  production_potential_gain := LEAST(max_quality - COALESCE(p_current_production_potential, 0), FLOOR(quality_base * inspiration_modifier));

  song_rating_gain := LEAST(
    max_quality - COALESCE(p_current_song_rating, 0),
    FLOOR(
      (lyrics_quality_gain * 0.25) +
      (melody_quality_gain * 0.25) +
      (rhythm_quality_gain * 0.15) +
      (arrangement_quality_gain * 0.15) +
      (production_potential_gain * 0.20)
    )
  );

  xp_earned := GREATEST(
    8,
    FLOOR((music_gain + lyrics_gain) / 18) +
    FLOOR((lyrics_quality_gain + melody_quality_gain + rhythm_quality_gain + arrangement_quality_gain + production_potential_gain) / 240) +
    FLOOR(inspiration_modifier * 6)
  );

  RETURN jsonb_build_object(
    'music_gain', music_gain,
    'lyrics_gain', lyrics_gain,
    'lyrics_quality_gain', lyrics_quality_gain,
    'melody_quality_gain', melody_quality_gain,
    'rhythm_quality_gain', rhythm_quality_gain,
    'arrangement_quality_gain', arrangement_quality_gain,
    'production_potential_gain', production_potential_gain,
    'song_rating_gain', song_rating_gain,
    'xp_earned', xp_earned,
    'modifiers', jsonb_build_object(
      'skill', skill_modifier,
      'performance', performance_modifier,
      'attributes', attribute_modifier,
      'mood', mood_modifier,
      'health', health_modifier,
      'inspiration', inspiration_modifier,
      'familiarity', familiarity_modifier
    )
  );
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
COMMIT;
