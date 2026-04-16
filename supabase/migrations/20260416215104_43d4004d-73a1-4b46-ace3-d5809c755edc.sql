
-- 1. Project types catalog
CREATE TABLE public.city_project_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('infrastructure','culture','economy','quality_of_life')),
  name TEXT NOT NULL,
  description TEXT,
  base_cost BIGINT NOT NULL DEFAULT 10000,
  duration_days INTEGER NOT NULL DEFAULT 7,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_change INTEGER NOT NULL DEFAULT 5,
  required_skill_slug TEXT,
  required_skill_level INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.city_project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view project types"
  ON public.city_project_types FOR SELECT USING (true);

-- 2. City projects
CREATE TABLE public.city_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  mayor_id UUID REFERENCES public.city_mayors(id) ON DELETE SET NULL,
  project_type_id UUID REFERENCES public.city_project_types(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost BIGINT NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('proposed','in_progress','completed','cancelled','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completes_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at TIMESTAMPTZ,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_change INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_city_projects_city ON public.city_projects(city_id);
CREATE INDEX idx_city_projects_status ON public.city_projects(status);
CREATE INDEX idx_city_projects_completes_at ON public.city_projects(completes_at) WHERE status = 'in_progress';

ALTER TABLE public.city_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view city projects"
  ON public.city_projects FOR SELECT USING (true);

CREATE POLICY "Mayors can create projects in their city"
  ON public.city_projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.city_mayors cm
      JOIN public.profiles p ON p.id = cm.profile_id
      WHERE cm.city_id = city_projects.city_id
        AND cm.is_current = true
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Mayors can update projects in their city"
  ON public.city_projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.city_mayors cm
      JOIN public.profiles p ON p.id = cm.profile_id
      WHERE cm.city_id = city_projects.city_id
        AND cm.is_current = true
        AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_city_projects_updated_at
  BEFORE UPDATE ON public.city_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Mayor actions log
CREATE TABLE public.mayor_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  mayor_id UUID REFERENCES public.city_mayors(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  amount BIGINT,
  target_id UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mayor_actions_log_city ON public.mayor_actions_log(city_id);
CREATE INDEX idx_mayor_actions_log_created ON public.mayor_actions_log(created_at DESC);

ALTER TABLE public.mayor_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mayor actions"
  ON public.mayor_actions_log FOR SELECT USING (true);

CREATE POLICY "Mayors can log their own actions"
  ON public.mayor_actions_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.city_mayors cm
      JOIN public.profiles p ON p.id = cm.profile_id
      WHERE cm.city_id = mayor_actions_log.city_id
        AND cm.is_current = true
        AND p.user_id = auth.uid()
    )
  );

-- 4. city_treasury additions
ALTER TABLE public.city_treasury
  ADD COLUMN IF NOT EXISTS weekly_budget BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_paid BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_commitments BIGINT NOT NULL DEFAULT 0;

-- 5. city_mayors additions
ALTER TABLE public.city_mayors
  ADD COLUMN IF NOT EXISTS salary_per_week BIGINT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS corruption_score INTEGER NOT NULL DEFAULT 0 CHECK (corruption_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS vetoed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projects_completed INTEGER NOT NULL DEFAULT 0;

-- 6. Seed politics skills
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps)
VALUES
  ('basic_public_speaking', 'Public Speaking', 'Boosts approval gain from press conferences and speeches', '{"family":"politics","tier":"basic"}'::jsonb),
  ('basic_negotiation', 'Negotiation', 'Reduces project costs by 5-15%', '{"family":"politics","tier":"basic"}'::jsonb),
  ('basic_governance', 'Governance', 'Unlocks more advanced city projects', '{"family":"politics","tier":"basic"}'::jsonb),
  ('professional_diplomacy', 'Diplomacy', 'Reduces inter-city conflict and enables trade deals', '{"family":"politics","tier":"professional"}'::jsonb),
  ('professional_campaign_strategy', 'Campaign Strategy', 'Boosts vote totals during elections', '{"family":"politics","tier":"professional"}'::jsonb),
  ('master_statecraft', 'Statecraft', 'Unlocks city-wide referendums and emergency powers', '{"family":"politics","tier":"master"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- 7. Seed project types
INSERT INTO public.city_project_types (slug, category, name, description, base_cost, duration_days, effects, approval_change, required_skill_slug, required_skill_level, icon)
VALUES
  ('build_music_venue', 'infrastructure', 'Build Music Venue', 'Construct a new mid-size venue, expanding the local scene', 50000, 14, '{"venues":1,"music_scene":3}'::jsonb, 8, 'basic_governance', 200, 'Building'),
  ('build_concert_hall', 'infrastructure', 'Build Concert Hall', 'A large-capacity venue for stadium-class shows', 250000, 30, '{"venues":1,"music_scene":5,"max_concert_capacity":5000}'::jsonb, 12, 'basic_governance', 500, 'Theater'),
  ('upgrade_train_network', 'infrastructure', 'Upgrade Train Network', 'Improve transit access for touring artists', 100000, 21, '{"local_bonus":2,"music_scene":2}'::jsonb, 10, 'basic_governance', 200, 'Train'),
  ('music_festival_sponsorship', 'culture', 'Music Festival Sponsorship', 'Sponsor an annual music festival', 75000, 10, '{"music_scene":4,"local_bonus":3}'::jsonb, 15, null, 0, 'PartyPopper'),
  ('public_art_program', 'culture', 'Public Art Program', 'Beautify the city with murals and installations', 25000, 7, '{"local_bonus":2}'::jsonb, 10, null, 0, 'Palette'),
  ('music_education_grant', 'culture', 'Music Education Grant', 'Fund music programs in local schools', 40000, 14, '{"music_scene":3,"local_bonus":2}'::jsonb, 8, 'basic_governance', 100, 'GraduationCap'),
  ('tax_office_modernization', 'economy', 'Tax Office Modernization', 'Improve collection efficiency', 60000, 21, '{"weekly_budget_bonus":2000}'::jsonb, 3, 'basic_negotiation', 200, 'Calculator'),
  ('tourism_campaign', 'economy', 'Tourism Campaign', 'Attract visitors and grow the population', 35000, 14, '{"population":500,"local_bonus":1}'::jsonb, 7, null, 0, 'Plane'),
  ('noise_reduction_initiative', 'quality_of_life', 'Noise Reduction Initiative', 'Soundproof residential areas near venues', 30000, 10, '{"local_bonus":1}'::jsonb, 6, null, 0, 'VolumeX'),
  ('public_safety_boost', 'quality_of_life', 'Public Safety Boost', 'Hire more security for venues and events', 45000, 14, '{"local_bonus":2,"music_scene":1}'::jsonb, 8, 'basic_governance', 100, 'Shield'),
  ('healthcare_subsidy', 'quality_of_life', 'Healthcare Subsidy', 'Subsidize healthcare for working musicians', 80000, 21, '{"local_bonus":3}'::jsonb, 12, 'professional_diplomacy', 500, 'Heart')
ON CONFLICT (slug) DO NOTHING;
