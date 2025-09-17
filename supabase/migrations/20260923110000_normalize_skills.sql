-- Create skill definition catalog
CREATE TABLE public.skill_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  tier_caps jsonb NOT NULL,
  default_unlock_level integer NOT NULL DEFAULT 0,
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Establish skill dependency relationships
CREATE TABLE public.skill_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  related_skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  requirement_threshold integer,
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, related_skill_id, relationship_type)
);

-- Track per-profile skill progress
CREATE TABLE public.profile_skill_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  current_level integer NOT NULL DEFAULT 0,
  current_xp integer NOT NULL DEFAULT 0,
  tier integer NOT NULL DEFAULT 1,
  progress_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, skill_id)
);

-- Track which skills a profile has unlocked
CREATE TABLE public.profile_skill_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  is_unlocked boolean NOT NULL DEFAULT false,
  unlocked_at timestamptz,
  unlock_level integer NOT NULL DEFAULT 0,
  unlock_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, skill_id)
);

-- Seed skill definitions from existing player skill columns
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps, default_unlock_level, created_by_profile_id)
VALUES
  ('guitar', 'Guitar Mastery', 'Ability to perform and improvise on guitar across genres.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 0, NULL),
  ('vocals', 'Vocal Performance', 'Technique, range, and control for delivering vocal performances.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 0, NULL),
  ('drums', 'Percussion Skills', 'Timing, rhythm, and creativity behind the kit.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 0, NULL),
  ('bass', 'Bass Groove', 'Low-end control and groove crafting for any ensemble.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 0, NULL),
  ('performance', 'Stage Presence', 'Crowd engagement, endurance, and live showmanship.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 5, NULL),
  ('songwriting', 'Songwriting', 'Lyricism, melody crafting, and structure building.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 0, NULL),
  ('composition', 'Music Composition', 'Arranging complex pieces and orchestrating multi-part works.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":45},{"tier":3,"cap":70},{"tier":4,"cap":90},{"tier":5,"cap":100}]}'::jsonb, 20, NULL),
  ('technical', 'Technical Production', 'Studio technology, mixing, and engineering expertise.', '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":45},{"tier":3,"cap":70},{"tier":4,"cap":90},{"tier":5,"cap":100}]}'::jsonb, 15, NULL);

-- Establish baseline relationships between skills
INSERT INTO public.skill_relationships (skill_id, related_skill_id, relationship_type, requirement_threshold, created_by_profile_id)
SELECT
  (SELECT id FROM public.skill_definitions WHERE slug = 'composition'),
  (SELECT id FROM public.skill_definitions WHERE slug = 'songwriting'),
  'prerequisite',
  40,
  NULL
UNION ALL
SELECT
  (SELECT id FROM public.skill_definitions WHERE slug = 'technical'),
  (SELECT id FROM public.skill_definitions WHERE slug = 'performance'),
  'synergy',
  30,
  NULL;

-- Pivot existing player skill data into the progress table
INSERT INTO public.profile_skill_progress (profile_id, skill_id, current_level, current_xp, tier, progress_metadata)
SELECT ps.profile_id, sd.id, COALESCE(ps.guitar, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'guitar'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.vocals, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'vocals'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.drums, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'drums'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.bass, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'bass'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.performance, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'performance'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.songwriting, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'songwriting'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.composition, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'composition'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.technical, 0), 0, 1, jsonb_build_object('source', 'legacy')
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'technical'
WHERE ps.profile_id IS NOT NULL;

-- Pivot unlock states based on existing levels
INSERT INTO public.profile_skill_unlocks (profile_id, skill_id, is_unlocked, unlocked_at, unlock_level, unlock_source)
SELECT ps.profile_id, sd.id, COALESCE(ps.guitar, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'guitar'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.vocals, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'vocals'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.drums, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'drums'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.bass, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'bass'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.performance, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'performance'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.songwriting, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'songwriting'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.composition, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'composition'
WHERE ps.profile_id IS NOT NULL
UNION ALL
SELECT ps.profile_id, sd.id, COALESCE(ps.technical, 0) >= sd.default_unlock_level, ps.updated_at, sd.default_unlock_level, 'legacy'
FROM public.player_skills ps
JOIN public.skill_definitions sd ON sd.slug = 'technical'
WHERE ps.profile_id IS NOT NULL;

-- Enable row level security and policies mirroring player_skills
ALTER TABLE public.skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skill_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skill definitions are viewable by everyone" ON public.skill_definitions FOR SELECT USING (true);
CREATE POLICY "Skill definitions are manageable by their creator" ON public.skill_definitions
FOR INSERT WITH CHECK (
  created_by_profile_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = skill_definitions.created_by_profile_id
      AND p.user_id = auth.uid()
  )
);
CREATE POLICY "Skill definitions can be updated by their creator" ON public.skill_definitions
FOR UPDATE USING (
  created_by_profile_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = skill_definitions.created_by_profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  created_by_profile_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = skill_definitions.created_by_profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Skill relationships are viewable by everyone" ON public.skill_relationships FOR SELECT USING (true);
CREATE POLICY "Skill relationships are manageable by their creator" ON public.skill_relationships
FOR INSERT WITH CHECK (
  created_by_profile_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = skill_relationships.created_by_profile_id
      AND p.user_id = auth.uid()
  )
);
CREATE POLICY "Skill relationships can be updated by their creator" ON public.skill_relationships
FOR UPDATE USING (
  created_by_profile_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = skill_relationships.created_by_profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  created_by_profile_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = skill_relationships.created_by_profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Profile skill progress is viewable by everyone" ON public.profile_skill_progress FOR SELECT USING (true);
CREATE POLICY "Users can upsert their skill progress" ON public.profile_skill_progress
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = profile_skill_progress.profile_id
      AND p.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update their skill progress" ON public.profile_skill_progress
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = profile_skill_progress.profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = profile_skill_progress.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Profile skill unlocks are viewable by everyone" ON public.profile_skill_unlocks FOR SELECT USING (true);
CREATE POLICY "Users can upsert their skill unlocks" ON public.profile_skill_unlocks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = profile_skill_unlocks.profile_id
      AND p.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update their skill unlocks" ON public.profile_skill_unlocks
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = profile_skill_unlocks.profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = profile_skill_unlocks.profile_id
      AND p.user_id = auth.uid()
  )
);

-- Supporting indexes for performance
CREATE INDEX skill_definitions_owner_idx ON public.skill_definitions (created_by_profile_id);
CREATE INDEX skill_relationships_skill_idx ON public.skill_relationships (skill_id, related_skill_id);
CREATE INDEX skill_relationships_owner_idx ON public.skill_relationships (created_by_profile_id);
CREATE INDEX profile_skill_progress_profile_idx ON public.profile_skill_progress (profile_id, skill_id);
CREATE INDEX profile_skill_progress_skill_idx ON public.profile_skill_progress (skill_id);
CREATE INDEX profile_skill_unlocks_profile_idx ON public.profile_skill_unlocks (profile_id, skill_id);
CREATE INDEX profile_skill_unlocks_skill_idx ON public.profile_skill_unlocks (skill_id);
