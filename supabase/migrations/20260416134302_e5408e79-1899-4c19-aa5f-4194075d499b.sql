
-- Crafting Materials Catalog
CREATE TABLE public.crafting_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('wood', 'electronics', 'hardware', 'strings', 'finish')),
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  quality_tier INTEGER NOT NULL DEFAULT 1 CHECK (quality_tier BETWEEN 1 AND 5),
  base_cost INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crafting_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crafting materials"
  ON public.crafting_materials FOR SELECT
  USING (true);

-- Player Crafting Materials Inventory
CREATE TABLE public.player_crafting_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.crafting_materials(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, material_id)
);

ALTER TABLE public.player_crafting_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own materials"
  ON public.player_crafting_materials FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert own materials"
  ON public.player_crafting_materials FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own materials"
  ON public.player_crafting_materials FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can delete own materials"
  ON public.player_crafting_materials FOR DELETE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Crafting Recipes
CREATE TABLE public.crafting_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  result_category TEXT NOT NULL,
  result_subcategory TEXT,
  required_skill_slug TEXT NOT NULL DEFAULT 'luthiery',
  min_skill_level INTEGER NOT NULL DEFAULT 1,
  materials_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_craft_time_minutes INTEGER NOT NULL DEFAULT 60,
  difficulty_tier INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_tier BETWEEN 1 AND 5),
  rarity_output TEXT NOT NULL DEFAULT 'common',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crafting_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crafting recipes"
  ON public.crafting_recipes FOR SELECT
  USING (true);

-- Crafting Sessions
CREATE TABLE public.crafting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.crafting_recipes(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'collected')),
  quality_roll NUMERIC,
  bonus_stats JSONB,
  result_equipment_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crafting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own sessions"
  ON public.crafting_sessions FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert own sessions"
  ON public.crafting_sessions FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own sessions"
  ON public.crafting_sessions FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Crafting Blueprints
CREATE TABLE public.crafting_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.crafting_recipes(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'purchased' CHECK (source IN ('purchased', 'mentor', 'achievement', 'drop')),
  UNIQUE (profile_id, recipe_id)
);

ALTER TABLE public.crafting_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own blueprints"
  ON public.crafting_blueprints FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert own blueprints"
  ON public.crafting_blueprints FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Extend equipment_items with crafting columns
ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS is_crafted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS crafted_by_profile_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Indexes
CREATE INDEX idx_player_crafting_materials_profile ON public.player_crafting_materials(profile_id);
CREATE INDEX idx_crafting_sessions_profile ON public.crafting_sessions(profile_id);
CREATE INDEX idx_crafting_sessions_status ON public.crafting_sessions(status);
CREATE INDEX idx_crafting_blueprints_profile ON public.crafting_blueprints(profile_id);
CREATE INDEX idx_equipment_items_crafted ON public.equipment_items(is_crafted) WHERE is_crafted = true;
