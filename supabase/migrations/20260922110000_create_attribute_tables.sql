BEGIN;

CREATE TABLE IF NOT EXISTS public.attribute_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  scale_max integer NOT NULL DEFAULT 10,
  default_value integer NOT NULL DEFAULT 1,
  weighting jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_attribute_definitions_updated_at ON public.attribute_definitions;
CREATE TRIGGER update_attribute_definitions_updated_at
  BEFORE UPDATE ON public.attribute_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.profile_attributes (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.attribute_definitions(id) ON DELETE CASCADE,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, attribute_id)
);

DROP TRIGGER IF EXISTS update_profile_attributes_updated_at ON public.profile_attributes;
CREATE TRIGGER update_profile_attributes_updated_at
  BEFORE UPDATE ON public.profile_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profile_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile attributes are viewable by their owner" ON public.profile_attributes;
CREATE POLICY "Profile attributes are viewable by their owner"
  ON public.profile_attributes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can insert their profile attributes" ON public.profile_attributes;
CREATE POLICY "Players can insert their profile attributes"
  ON public.profile_attributes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can update their profile attributes" ON public.profile_attributes;
CREATE POLICY "Players can update their profile attributes"
  ON public.profile_attributes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  );

WITH skill_catalog AS (
  SELECT slug,
    initcap(slug) AS label,
    format('Legacy %s skill migrated from player_skills.', slug) AS description,
    jsonb_build_object(slug, 1) AS weighting
  FROM (
    VALUES
      ('guitar'),
      ('vocals'),
      ('drums'),
      ('bass'),
      ('performance'),
      ('songwriting'),
      ('composition'),
      ('creativity'),
      ('business'),
      ('marketing'),
      ('technical')
  ) AS skill(slug)
)
INSERT INTO public.attribute_definitions (slug, label, description, scale_max, default_value, weighting)
SELECT
  slug,
  label,
  description,
  10,
  1,
  weighting
FROM skill_catalog
ON CONFLICT (slug) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  scale_max = EXCLUDED.scale_max,
  default_value = EXCLUDED.default_value,
  weighting = EXCLUDED.weighting;

WITH skill_values AS (
  SELECT
    ps.profile_id,
    skill.slug,
    CASE skill.slug
      WHEN 'guitar' THEN ps.guitar
      WHEN 'vocals' THEN ps.vocals
      WHEN 'drums' THEN ps.drums
      WHEN 'bass' THEN ps.bass
      WHEN 'performance' THEN ps.performance
      WHEN 'songwriting' THEN ps.songwriting
      WHEN 'composition' THEN ps.composition
      WHEN 'creativity' THEN ps.creativity
      WHEN 'business' THEN ps.business
      WHEN 'marketing' THEN ps.marketing
      WHEN 'technical' THEN ps.technical
      ELSE NULL
    END AS value
  FROM public.player_skills ps
  CROSS JOIN (
    VALUES
      ('guitar'),
      ('vocals'),
      ('drums'),
      ('bass'),
      ('performance'),
      ('songwriting'),
      ('composition'),
      ('creativity'),
      ('business'),
      ('marketing'),
      ('technical')
  ) AS skill(slug)
  WHERE ps.profile_id IS NOT NULL
), joined_values AS (
  SELECT
    sv.profile_id,
    ad.id AS attribute_id,
    COALESCE(sv.value, ad.default_value) AS value
  FROM skill_values sv
  JOIN public.attribute_definitions ad
    ON ad.slug = sv.slug
)
INSERT INTO public.profile_attributes (profile_id, attribute_id, value)
SELECT profile_id, attribute_id, value
FROM joined_values
ON CONFLICT (profile_id, attribute_id) DO UPDATE
SET value = EXCLUDED.value;

COMMIT;
