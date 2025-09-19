-- Create the core skills hierarchy table
CREATE TABLE IF NOT EXISTS public.skills (
  skill_id text PRIMARY KEY,
  skill_name text NOT NULL,
  skill_child_id text[] NOT NULL DEFAULT '{}'::text[],
  skill_parent_id text REFERENCES public.skills(skill_id),
  learning_impact numeric NOT NULL DEFAULT 0,
  performance_impact numeric NOT NULL DEFAULT 0,
  xp_impact numeric NOT NULL DEFAULT 0,
  recording_impact numeric NOT NULL DEFAULT 0,
  writing_impact numeric NOT NULL DEFAULT 0,
  fame_impact numeric NOT NULL DEFAULT 0,
  sales_impact numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS skills_skill_parent_id_idx ON public.skills(skill_parent_id);

-- Populate the skills table using the generated seed data
\i ../seed/skills_seed.sql
