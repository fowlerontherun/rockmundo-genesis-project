-- Lower default skill baselines and enforce a 13-point allocation cap
ALTER TABLE public.player_skills
  ALTER COLUMN guitar SET DEFAULT 1,
  ALTER COLUMN vocals SET DEFAULT 1,
  ALTER COLUMN drums SET DEFAULT 1,
  ALTER COLUMN bass SET DEFAULT 1,
  ALTER COLUMN performance SET DEFAULT 1,
  ALTER COLUMN songwriting SET DEFAULT 1,
  ALTER COLUMN composition SET DEFAULT 1,
  ALTER COLUMN creativity SET DEFAULT 1,
  ALTER COLUMN business SET DEFAULT 1,
  ALTER COLUMN marketing SET DEFAULT 1,
  ALTER COLUMN technical SET DEFAULT 1;

-- Rebaseline existing rows so totals land within the 13 point cap
WITH ordered_skills AS (
  SELECT
    id,
    ARRAY(
      SELECT skill_name
      FROM (
        VALUES
          ('guitar', COALESCE(guitar, 0)),
          ('vocals', COALESCE(vocals, 0)),
          ('drums', COALESCE(drums, 0)),
          ('bass', COALESCE(bass, 0)),
          ('performance', COALESCE(performance, 0)),
          ('songwriting', COALESCE(songwriting, 0)),
          ('composition', COALESCE(composition, 0)),
          ('creativity', COALESCE(creativity, 0)),
          ('business', COALESCE(business, 0)),
          ('marketing', COALESCE(marketing, 0)),
          ('technical', COALESCE(technical, 0))
      ) AS skill(skill_name, skill_value)
      ORDER BY skill_value DESC, skill_name
    ) AS ranked_skills
  FROM public.player_skills
),
rebased AS (
  SELECT
    os.id,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'guitar'), 0) <= 2 THEN 1 ELSE 0 END AS guitar,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'vocals'), 0) <= 2 THEN 1 ELSE 0 END AS vocals,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'drums'), 0) <= 2 THEN 1 ELSE 0 END AS drums,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'bass'), 0) <= 2 THEN 1 ELSE 0 END AS bass,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'performance'), 0) <= 2 THEN 1 ELSE 0 END AS performance,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'songwriting'), 0) <= 2 THEN 1 ELSE 0 END AS songwriting,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'composition'), 0) <= 2 THEN 1 ELSE 0 END AS composition,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'creativity'), 0) <= 2 THEN 1 ELSE 0 END AS creativity,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'business'), 0) <= 2 THEN 1 ELSE 0 END AS business,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'marketing'), 0) <= 2 THEN 1 ELSE 0 END AS marketing,
    1 + CASE WHEN COALESCE(array_position(os.ranked_skills, 'technical'), 0) <= 2 THEN 1 ELSE 0 END AS technical
  FROM ordered_skills os
)
UPDATE public.player_skills AS ps
SET
  guitar = rebased.guitar,
  vocals = rebased.vocals,
  drums = rebased.drums,
  bass = rebased.bass,
  performance = rebased.performance,
  songwriting = rebased.songwriting,
  composition = rebased.composition,
  creativity = rebased.creativity,
  business = rebased.business,
  marketing = rebased.marketing,
  technical = rebased.technical
FROM rebased
WHERE ps.id = rebased.id;

-- Ensure values stay within 1-10 bounds for legacy records
UPDATE public.player_skills
SET
  guitar = LEAST(GREATEST(guitar, 1), 10),
  vocals = LEAST(GREATEST(vocals, 1), 10),
  drums = LEAST(GREATEST(drums, 1), 10),
  bass = LEAST(GREATEST(bass, 1), 10),
  performance = LEAST(GREATEST(performance, 1), 10),
  songwriting = LEAST(GREATEST(songwriting, 1), 10),
  composition = LEAST(GREATEST(composition, 1), 10),
  creativity = LEAST(GREATEST(creativity, 1), 10),
  business = LEAST(GREATEST(business, 1), 10),
  marketing = LEAST(GREATEST(marketing, 1), 10),
  technical = LEAST(GREATEST(technical, 1), 10);

-- Tighten column constraints to match the new allocation rules
ALTER TABLE public.player_skills
  ALTER COLUMN guitar SET NOT NULL,
  ALTER COLUMN vocals SET NOT NULL,
  ALTER COLUMN drums SET NOT NULL,
  ALTER COLUMN bass SET NOT NULL,
  ALTER COLUMN performance SET NOT NULL,
  ALTER COLUMN songwriting SET NOT NULL,
  ALTER COLUMN composition SET NOT NULL,
  ALTER COLUMN creativity SET NOT NULL,
  ALTER COLUMN business SET NOT NULL,
  ALTER COLUMN marketing SET NOT NULL,
  ALTER COLUMN technical SET NOT NULL;

ALTER TABLE public.player_skills
  DROP CONSTRAINT IF EXISTS player_skills_value_bounds_check,
  DROP CONSTRAINT IF EXISTS player_skills_total_points_check;

ALTER TABLE public.player_skills
  ADD CONSTRAINT player_skills_value_bounds_check CHECK (
    guitar BETWEEN 1 AND 10 AND
    vocals BETWEEN 1 AND 10 AND
    drums BETWEEN 1 AND 10 AND
    bass BETWEEN 1 AND 10 AND
    performance BETWEEN 1 AND 10 AND
    songwriting BETWEEN 1 AND 10 AND
    composition BETWEEN 1 AND 10 AND
    creativity BETWEEN 1 AND 10 AND
    business BETWEEN 1 AND 10 AND
    marketing BETWEEN 1 AND 10 AND
    technical BETWEEN 1 AND 10
  ),
  ADD CONSTRAINT player_skills_total_points_check CHECK (
    guitar + vocals + drums + bass + performance + songwriting + composition + creativity + business + marketing + technical <= 13
  );
