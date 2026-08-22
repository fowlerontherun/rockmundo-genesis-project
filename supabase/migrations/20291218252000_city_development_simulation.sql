-- City development simulation layer.
-- Adds explicit city ratings, maps existing mayor projects onto those ratings,
-- and exposes one bounded modifier contract for gameplay systems.

CREATE TABLE IF NOT EXISTS public.city_development (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id) ON DELETE CASCADE,
  economy smallint NOT NULL DEFAULT 50 CHECK (economy BETWEEN 0 AND 100),
  infrastructure smallint NOT NULL DEFAULT 50 CHECK (infrastructure BETWEEN 0 AND 100),
  transport smallint NOT NULL DEFAULT 50 CHECK (transport BETWEEN 0 AND 100),
  public_safety smallint NOT NULL DEFAULT 50 CHECK (public_safety BETWEEN 0 AND 100),
  healthcare smallint NOT NULL DEFAULT 50 CHECK (healthcare BETWEEN 0 AND 100),
  culture smallint NOT NULL DEFAULT 50 CHECK (culture BETWEEN 0 AND 100),
  music_scene smallint NOT NULL DEFAULT 50 CHECK (music_scene BETWEEN 0 AND 100),
  tourism smallint NOT NULL DEFAULT 50 CHECK (tourism BETWEEN 0 AND 100),
  quality_of_life smallint NOT NULL DEFAULT 50 CHECK (quality_of_life BETWEEN 0 AND 100),
  education smallint NOT NULL DEFAULT 50 CHECK (education BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.city_development ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "City development is viewable by everyone" ON public.city_development;
CREATE POLICY "City development is viewable by everyone"
  ON public.city_development
  FOR SELECT
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.city_development FROM anon, authenticated;
GRANT SELECT ON public.city_development TO anon, authenticated;
GRANT ALL ON public.city_development TO service_role;

-- Preserve the city's existing music-scene identity when introducing the new
-- rating model. Other ratings deliberately begin neutral rather than inventing
-- historical differences that were never simulated before this migration.
INSERT INTO public.city_development (
  city_id,
  economy,
  infrastructure,
  transport,
  public_safety,
  healthcare,
  culture,
  music_scene,
  tourism,
  quality_of_life,
  education
)
SELECT
  c.id,
  50,
  50,
  CASE WHEN COALESCE(c.has_train_network, false) THEN 55 ELSE 50 END,
  50,
  50,
  LEAST(100, GREATEST(0, 45 + ROUND(COALESCE(c.music_scene, 50)::numeric / 10)::integer)),
  LEAST(100, GREATEST(0, COALESCE(c.music_scene, 50)::integer)),
  50,
  LEAST(100, GREATEST(0, 50 + LEAST(10, COALESCE(c.local_bonus, 0)::integer))),
  50
FROM public.cities c
ON CONFLICT (city_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.city_development_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.city_projects(id) ON DELETE SET NULL,
  mayor_id uuid REFERENCES public.city_mayors(id) ON DELETE SET NULL,
  source text NOT NULL,
  deltas jsonb NOT NULL DEFAULT '{}'::jsonb,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_city_development_history_city_created
  ON public.city_development_history(city_id, created_at DESC);

ALTER TABLE public.city_development_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "City development history is viewable by everyone" ON public.city_development_history;
CREATE POLICY "City development history is viewable by everyone"
  ON public.city_development_history
  FOR SELECT
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.city_development_history FROM anon, authenticated;
GRANT SELECT ON public.city_development_history TO anon, authenticated;
GRANT ALL ON public.city_development_history TO service_role;

CREATE OR REPLACE FUNCTION public.clamp_city_rating(p_value numeric)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT LEAST(100, GREATEST(0, ROUND(COALESCE(p_value, 0))))::smallint;
$$;

REVOKE ALL ON FUNCTION public.clamp_city_rating(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clamp_city_rating(numeric) TO anon, authenticated, service_role;

-- One public read contract for every gameplay system. All modifiers are bounded
-- and neutral at a rating of 50 so upgrades matter without overwhelming the
-- existing balance model.
CREATE OR REPLACE FUNCTION public.city_gameplay_modifiers(p_city_id uuid)
RETURNS TABLE (
  economy_rating smallint,
  infrastructure_rating smallint,
  transport_rating smallint,
  public_safety_rating smallint,
  healthcare_rating smallint,
  culture_rating smallint,
  music_scene_rating smallint,
  tourism_rating smallint,
  quality_of_life_rating smallint,
  education_rating smallint,
  economy_revenue_multiplier numeric,
  audience_demand_multiplier numeric,
  travel_cost_multiplier numeric,
  travel_duration_multiplier numeric,
  incident_risk_multiplier numeric,
  recovery_multiplier numeric,
  festival_demand_multiplier numeric,
  tax_base_multiplier numeric,
  logistics_multiplier numeric,
  local_talent_multiplier numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    d.economy,
    d.infrastructure,
    d.transport,
    d.public_safety,
    d.healthcare,
    d.culture,
    d.music_scene,
    d.tourism,
    d.quality_of_life,
    d.education,
    ROUND((0.90 + d.economy * 0.002)::numeric, 4),
    ROUND((0.89 + ((d.culture + d.music_scene + d.tourism)::numeric / 3) * 0.0022)::numeric, 4),
    ROUND((1.10 - d.transport * 0.002)::numeric, 4),
    ROUND((1.08 - d.transport * 0.0016)::numeric, 4),
    ROUND((1.20 - ((d.public_safety + d.infrastructure)::numeric / 2) * 0.004)::numeric, 4),
    ROUND((0.90 + ((d.healthcare + d.quality_of_life)::numeric / 2) * 0.002)::numeric, 4),
    ROUND((0.88 + ((d.culture + d.tourism + d.music_scene)::numeric / 3) * 0.0024)::numeric, 4),
    ROUND((0.90 + ((d.economy + d.tourism)::numeric / 2) * 0.002)::numeric, 4),
    ROUND((0.90 + ((d.infrastructure + d.transport)::numeric / 2) * 0.002)::numeric, 4),
    ROUND((0.90 + ((d.education + d.music_scene)::numeric / 2) * 0.002)::numeric, 4)
  FROM public.city_development d
  WHERE d.city_id = p_city_id;
$$;

REVOKE ALL ON FUNCTION public.city_gameplay_modifiers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.city_gameplay_modifiers(uuid) TO anon, authenticated, service_role;

-- Map the existing project catalogue onto explicit city development ratings.
-- Legacy effect keys are retained for compatibility with current city fields.
UPDATE public.city_project_types SET effects = effects || '{"infrastructure_rating":3,"music_scene_rating":3,"culture_rating":1}'::jsonb
WHERE slug = 'build_music_venue';

UPDATE public.city_project_types SET effects = effects || '{"infrastructure_rating":5,"music_scene_rating":5,"culture_rating":2,"tourism_rating":2}'::jsonb
WHERE slug = 'build_concert_hall';

UPDATE public.city_project_types SET effects = effects || '{"transport_rating":8,"infrastructure_rating":4,"tourism_rating":2}'::jsonb
WHERE slug = 'upgrade_train_network';

UPDATE public.city_project_types SET effects = effects || '{"culture_rating":6,"music_scene_rating":4,"tourism_rating":4}'::jsonb
WHERE slug = 'music_festival_sponsorship';

UPDATE public.city_project_types SET effects = effects || '{"culture_rating":4,"tourism_rating":2,"quality_of_life_rating":2}'::jsonb
WHERE slug = 'public_art_program';

UPDATE public.city_project_types SET effects = effects || '{"education_rating":7,"music_scene_rating":3,"culture_rating":2}'::jsonb
WHERE slug = 'music_education_grant';

UPDATE public.city_project_types SET effects = effects || '{"economy_rating":5}'::jsonb
WHERE slug = 'tax_office_modernization';

UPDATE public.city_project_types SET effects = effects || '{"tourism_rating":8,"economy_rating":2,"quality_of_life_rating":1}'::jsonb
WHERE slug = 'tourism_campaign';

UPDATE public.city_project_types SET effects = effects || '{"quality_of_life_rating":4,"infrastructure_rating":1}'::jsonb
WHERE slug = 'noise_reduction_initiative';

UPDATE public.city_project_types SET effects = effects || '{"public_safety_rating":8,"quality_of_life_rating":2,"music_scene_rating":1}'::jsonb
WHERE slug = 'public_safety_boost';

UPDATE public.city_project_types SET effects = effects || '{"healthcare_rating":8,"quality_of_life_rating":4}'::jsonb
WHERE slug = 'healthcare_subsidy';

-- In-progress projects captured their effects at proposal time. Merge the new
-- catalogue effects into those rows so already-funded work still upgrades the
-- development model when it completes.
UPDATE public.city_projects p
SET effects = p.effects || t.effects,
    updated_at = now()
FROM public.city_project_types t
WHERE p.project_type_id = t.id
  AND p.status = 'in_progress';

CREATE OR REPLACE FUNCTION public.apply_city_project_development_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.city_development%ROWTYPE;
  v_after public.city_development%ROWTYPE;
  v_deltas jsonb;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.city_development (city_id)
  VALUES (NEW.city_id)
  ON CONFLICT (city_id) DO NOTHING;

  SELECT * INTO v_before
  FROM public.city_development
  WHERE city_id = NEW.city_id
  FOR UPDATE;

  v_deltas := jsonb_strip_nulls(jsonb_build_object(
    'economy', NULLIF(NEW.effects ->> 'economy_rating', '')::integer,
    'infrastructure', NULLIF(NEW.effects ->> 'infrastructure_rating', '')::integer,
    'transport', NULLIF(NEW.effects ->> 'transport_rating', '')::integer,
    'public_safety', NULLIF(NEW.effects ->> 'public_safety_rating', '')::integer,
    'healthcare', NULLIF(NEW.effects ->> 'healthcare_rating', '')::integer,
    'culture', NULLIF(NEW.effects ->> 'culture_rating', '')::integer,
    'music_scene', NULLIF(NEW.effects ->> 'music_scene_rating', '')::integer,
    'tourism', NULLIF(NEW.effects ->> 'tourism_rating', '')::integer,
    'quality_of_life', NULLIF(NEW.effects ->> 'quality_of_life_rating', '')::integer,
    'education', NULLIF(NEW.effects ->> 'education_rating', '')::integer
  ));

  UPDATE public.city_development
  SET economy = public.clamp_city_rating(economy + COALESCE((NEW.effects ->> 'economy_rating')::numeric, 0)),
      infrastructure = public.clamp_city_rating(infrastructure + COALESCE((NEW.effects ->> 'infrastructure_rating')::numeric, 0)),
      transport = public.clamp_city_rating(transport + COALESCE((NEW.effects ->> 'transport_rating')::numeric, 0)),
      public_safety = public.clamp_city_rating(public_safety + COALESCE((NEW.effects ->> 'public_safety_rating')::numeric, 0)),
      healthcare = public.clamp_city_rating(healthcare + COALESCE((NEW.effects ->> 'healthcare_rating')::numeric, 0)),
      culture = public.clamp_city_rating(culture + COALESCE((NEW.effects ->> 'culture_rating')::numeric, 0)),
      music_scene = public.clamp_city_rating(music_scene + COALESCE((NEW.effects ->> 'music_scene_rating')::numeric, 0)),
      tourism = public.clamp_city_rating(tourism + COALESCE((NEW.effects ->> 'tourism_rating')::numeric, 0)),
      quality_of_life = public.clamp_city_rating(quality_of_life + COALESCE((NEW.effects ->> 'quality_of_life_rating')::numeric, 0)),
      education = public.clamp_city_rating(education + COALESCE((NEW.effects ->> 'education_rating')::numeric, 0)),
      updated_at = now()
  WHERE city_id = NEW.city_id
  RETURNING * INTO v_after;

  INSERT INTO public.city_development_history (
    city_id,
    project_id,
    mayor_id,
    source,
    deltas,
    before_state,
    after_state
  ) VALUES (
    NEW.city_id,
    NEW.id,
    NEW.mayor_id,
    'city_project',
    COALESCE(v_deltas, '{}'::jsonb),
    to_jsonb(v_before) - 'updated_at',
    to_jsonb(v_after) - 'updated_at'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_city_project_development_effects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_city_project_development_effects() TO service_role;

DROP TRIGGER IF EXISTS apply_city_project_development_effects_trigger ON public.city_projects;
CREATE TRIGGER apply_city_project_development_effects_trigger
AFTER UPDATE OF status ON public.city_projects
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
EXECUTE FUNCTION public.apply_city_project_development_effects();

NOTIFY pgrst, 'reload schema';
