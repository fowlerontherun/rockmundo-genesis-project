-- Canonical skills and relationships catalogue. Idempotent and progress-preserving.

ALTER TABLE public.skill_definitions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS skill_type text NOT NULL DEFAULT 'foundation',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_practiceable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_foundational boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_level integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS progression_curve_key text NOT NULL DEFAULT 'standard_skill',
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS icon_key text;

ALTER TABLE public.skill_definitions
  DROP CONSTRAINT IF EXISTS skill_definitions_skill_type_check,
  ADD CONSTRAINT skill_definitions_skill_type_check CHECK (skill_type IN ('foundation','instrument','vocal','performance','songwriting','theory','production','genre','business','social','health','teaching','craft','specialist','mastery'));

CREATE TABLE IF NOT EXISTS public.skill_attribute_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  relationship_type text NOT NULL DEFAULT 'learning_speed',
  weight numeric(6,4) NOT NULL CHECK (weight > 0 AND weight <= 1),
  max_bonus numeric(6,4) NOT NULL DEFAULT 0.5 CHECK (max_bonus >= 0 AND max_bonus <= 1),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, attribute_key, relationship_type)
);

CREATE TABLE IF NOT EXISTS public.skill_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  prerequisite_skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE RESTRICT,
  required_level integer NOT NULL DEFAULT 1 CHECK (required_level >= 0),
  prerequisite_type text NOT NULL DEFAULT 'required' CHECK (prerequisite_type IN ('required','one_of','recommended','hidden_unlock')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (skill_id <> prerequisite_skill_id),
  UNIQUE (skill_id, prerequisite_skill_id, prerequisite_type)
);

CREATE TABLE IF NOT EXISTS public.skill_unlock_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  route_type text NOT NULL CHECK (route_type IN ('starter','lesson','university_course','activity','rehearsal','performance','book','mentor','achievement','admin','hidden_discovery')),
  source_key text NOT NULL,
  minimum_source_level integer NOT NULL DEFAULT 0,
  unlock_level integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, route_type, source_key)
);

CREATE TABLE IF NOT EXISTS public.skill_system_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  system_key text NOT NULL CHECK (system_key IN ('skill_learning','rehearsal','songwriting','recording','live_gig','touring','education','teaching','business','social_media','interviews','equipment_crafting','wellness')),
  usage_type text NOT NULL CHECK (usage_type IN ('primary','secondary','prerequisite','modifier','unlock','recommendation')),
  weight numeric(6,4) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, system_key, usage_type)
);

CREATE TABLE IF NOT EXISTS public.skill_role_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  role_key text NOT NULL CHECK (role_key IN ('lead_vocalist','backing_vocalist','lead_guitarist','rhythm_guitarist','bassist','drummer','keyboard_player','dj','producer','songwriter','bandleader','live_frontperson','sound_engineer')),
  relevance text NOT NULL DEFAULT 'primary' CHECK (relevance IN ('primary','secondary','supporting')),
  weight numeric(6,4) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 1),
  minimum_recommended_level integer NOT NULL DEFAULT 10 CHECK (minimum_recommended_level >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, role_key)
);

WITH seed(slug, display_name, description, category, subcategory, tier, skill_type, is_foundational, display_order, icon_key) AS (VALUES
  ('guitar','Guitar Mastery','Ability to perform and improvise on guitar across genres.','Instruments','Strings','basic','instrument',true,10,'guitar'),
  ('vocals','Vocal Performance','Pitch, range and delivery for vocal performances.','Performance','Vocals','basic','vocal',true,20,'mic'),
  ('drums','Percussion Skills','Timing, groove and creativity behind the kit.','Instruments','Percussion','basic','instrument',true,30,'drums'),
  ('bass','Bass Groove','Low-end control and groove crafting for any ensemble.','Instruments','Strings','basic','instrument',true,40,'bass'),
  ('performance','Stage Presence','Crowd engagement, stamina and live showmanship.','Stage','Showmanship','basic','performance',false,50,'stage'),
  ('songwriting','Songwriting','Lyricism, melody crafting and song structure.','Songwriting','Composition','basic','songwriting',true,60,'pen'),
  ('composition','Music Composition','Arranging complex pieces and orchestrating multi-part works.','Songwriting','Arrangement','professional','theory',false,70,'music'),
  ('technical','Technical Production','Studio technology, mixing and engineering expertise.','Production','Studio','professional','production',false,80,'sliders')
)
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps, default_unlock_level, category, subcategory, tier, skill_type, is_foundational, max_level, progression_curve_key, display_order, icon_key)
SELECT slug, display_name, description, '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb, 0, category, subcategory, tier, skill_type, is_foundational, 100, 'standard_skill', display_order, icon_key FROM seed
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, category = EXCLUDED.category, subcategory = EXCLUDED.subcategory, tier = EXCLUDED.tier, skill_type = EXCLUDED.skill_type, is_foundational = EXCLUDED.is_foundational, max_level = EXCLUDED.max_level, progression_curve_key = EXCLUDED.progression_curve_key, display_order = EXCLUDED.display_order, icon_key = EXCLUDED.icon_key, updated_at = now();

WITH links(skill_slug, attribute_key, weight, is_primary) AS (VALUES
 ('guitar','musical_ability',0.7,true),('guitar','musicality',0.3,false),('bass','musical_ability',0.6,true),('bass','rhythm_sense',0.4,false),('drums','rhythm_sense',0.7,true),('drums','musicality',0.3,false),('vocals','vocal_talent',0.7,true),('vocals','musicality',0.3,false),('performance','stage_presence',0.6,true),('performance','crowd_engagement',0.4,false),('songwriting','creative_insight',0.6,true),('songwriting','musicality',0.4,false),('composition','musicality',0.6,true),('composition','mental_focus',0.4,false),('technical','technical_mastery',0.7,true),('technical','creative_insight',0.3,false)
)
INSERT INTO public.skill_attribute_links (skill_id, attribute_key, relationship_type, weight, max_bonus, is_primary)
SELECT sd.id, l.attribute_key, 'learning_speed', l.weight, 0.5, l.is_primary FROM links l JOIN public.skill_definitions sd ON sd.slug = l.skill_slug
ON CONFLICT (skill_id, attribute_key, relationship_type) DO UPDATE SET weight = EXCLUDED.weight, max_bonus = EXCLUDED.max_bonus, is_primary = EXCLUDED.is_primary;

WITH prereqs(skill_slug, req_slug, required_level, prerequisite_type) AS (VALUES ('composition','songwriting',20,'required'),('technical','performance',15,'recommended'))
INSERT INTO public.skill_prerequisites (skill_id, prerequisite_skill_id, required_level, prerequisite_type)
SELECT s.id, r.id, p.required_level, p.prerequisite_type FROM prereqs p JOIN public.skill_definitions s ON s.slug=p.skill_slug JOIN public.skill_definitions r ON r.slug=p.req_slug
ON CONFLICT (skill_id, prerequisite_skill_id, prerequisite_type) DO UPDATE SET required_level = EXCLUDED.required_level;

INSERT INTO public.skill_unlock_routes (skill_id, route_type, source_key, minimum_source_level, unlock_level, is_active)
SELECT id, CASE WHEN is_foundational THEN 'starter' ELSE 'university_course' END, CASE WHEN is_foundational THEN 'new_profile' ELSE slug END, 0, CASE WHEN is_foundational THEN 0 ELSE 1 END, true FROM public.skill_definitions WHERE slug IN ('guitar','vocals','drums','bass','performance','songwriting','composition','technical')
ON CONFLICT (skill_id, route_type, source_key) DO NOTHING;

WITH systems(skill_slug, system_key, usage_type) AS (VALUES ('guitar','recording','primary'),('guitar','live_gig','primary'),('bass','recording','primary'),('bass','live_gig','primary'),('drums','recording','primary'),('drums','live_gig','primary'),('vocals','recording','primary'),('vocals','live_gig','primary'),('performance','live_gig','primary'),('songwriting','songwriting','primary'),('composition','songwriting','modifier'),('technical','recording','primary'))
INSERT INTO public.skill_system_links (skill_id, system_key, usage_type, weight)
SELECT sd.id, s.system_key, s.usage_type, 1 FROM systems s JOIN public.skill_definitions sd ON sd.slug=s.skill_slug
ON CONFLICT (skill_id, system_key, usage_type) DO NOTHING;

WITH roles(skill_slug, role_key) AS (VALUES ('guitar','lead_guitarist'),('guitar','rhythm_guitarist'),('bass','bassist'),('drums','drummer'),('vocals','lead_vocalist'),('vocals','backing_vocalist'),('performance','live_frontperson'),('songwriting','songwriter'),('composition','songwriter'),('technical','producer'),('technical','sound_engineer'))
INSERT INTO public.skill_role_links (skill_id, role_key, relevance, weight, minimum_recommended_level)
SELECT sd.id, r.role_key, 'primary', 1, 10 FROM roles r JOIN public.skill_definitions sd ON sd.slug=r.skill_slug
ON CONFLICT (skill_id, role_key) DO NOTHING;

CREATE OR REPLACE VIEW public.skill_catalogue_view AS
SELECT sd.id, sd.slug, sd.display_name AS name, sd.description, sd.category, sd.subcategory, sd.tier, sd.skill_type, sd.is_active, sd.is_hidden, sd.is_practiceable, sd.is_foundational, sd.max_level, sd.progression_curve_key, sd.display_order, sd.icon_key, sd.created_at, sd.updated_at
FROM public.skill_definitions sd
WHERE sd.is_active = true AND sd.is_hidden = false;

ALTER TABLE public.skill_attribute_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_unlock_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_system_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_role_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read skill attribute links" ON public.skill_attribute_links;
CREATE POLICY "Public can read skill attribute links" ON public.skill_attribute_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read skill prerequisites" ON public.skill_prerequisites;
CREATE POLICY "Public can read skill prerequisites" ON public.skill_prerequisites FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read active skill unlock routes" ON public.skill_unlock_routes;
CREATE POLICY "Public can read active skill unlock routes" ON public.skill_unlock_routes FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Public can read skill system links" ON public.skill_system_links;
CREATE POLICY "Public can read skill system links" ON public.skill_system_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read skill role links" ON public.skill_role_links;
CREATE POLICY "Public can read skill role links" ON public.skill_role_links FOR SELECT USING (true);
