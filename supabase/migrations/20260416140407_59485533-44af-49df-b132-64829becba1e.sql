-- Enchantment catalog: all available enchantments
CREATE TABLE public.enchantment_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tone',
  tier INTEGER NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  stat_modifier JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  material_cost JSONB NOT NULL DEFAULT '[]',
  cash_cost INTEGER NOT NULL DEFAULT 0,
  required_skill_slug TEXT,
  min_skill_level INTEGER NOT NULL DEFAULT 1,
  max_stacks INTEGER NOT NULL DEFAULT 1,
  incompatible_with UUID[] DEFAULT '{}',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.enchantment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enchantment catalog"
ON public.enchantment_catalog FOR SELECT
USING (true);

-- Applied enchantments on player equipment
CREATE TABLE public.equipment_enchantments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_equipment_id UUID NOT NULL,
  enchantment_id UUID NOT NULL REFERENCES public.enchantment_catalog(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  stack_count INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.equipment_enchantments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own enchantments"
ON public.equipment_enchantments FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Players can apply enchantments to their own equipment"
ON public.equipment_enchantments FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Players can remove their own enchantments"
ON public.equipment_enchantments FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Players can update their own enchantments"
ON public.equipment_enchantments FOR UPDATE
TO authenticated
USING (profile_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_equipment_enchantments_player_equip ON public.equipment_enchantments(player_equipment_id);
CREATE INDEX idx_equipment_enchantments_profile ON public.equipment_enchantments(profile_id);

-- Seed the enchantment catalog with starter enchantments
INSERT INTO public.enchantment_catalog (name, category, tier, stat_modifier, description, rarity, material_cost, cash_cost, required_skill_slug, min_skill_level, max_stacks, icon) VALUES
-- Tone enchantments
('Warm Resonance', 'tone', 1, '{"tone_warmth": 5}', 'Adds warmth and depth to the instrument''s natural voice.', 'common', '[]', 100, 'luthiery_basic_technical', 1, 3, '🔥'),
('Crystal Clarity', 'tone', 2, '{"tone_clarity": 10, "tone_brightness": 5}', 'Enhances high-end sparkle and note definition.', 'uncommon', '[]', 250, 'luthiery_basic_technical', 3, 2, '💎'),
('Vintage Mojo', 'tone', 3, '{"tone_warmth": 15, "tone_character": 10}', 'Imparts the coveted aged-wood character of a well-played vintage instrument.', 'rare', '[]', 500, 'luthiery_professional_technical', 5, 2, '🎭'),
('Harmonic Overtones', 'tone', 4, '{"tone_harmonics": 20, "tone_sustain": 10}', 'Unlocks rich harmonic overtones that sing with every note.', 'epic', '[]', 1200, 'luthiery_professional_technical', 7, 1, '🌊'),
('Voice of Legends', 'tone', 5, '{"tone_warmth": 25, "tone_clarity": 20, "tone_character": 15}', 'The instrument speaks with the voice of rock legends past.', 'legendary', '[]', 5000, 'luthiery_mastery_technical', 10, 1, '👑'),

-- Durability enchantments
('Reinforced Neck', 'durability', 1, '{"durability": 10}', 'Strengthens the neck joint against warping and stress.', 'common', '[]', 80, 'luthiery_basic_technical', 1, 3, '🛡️'),
('Climate Shield', 'durability', 2, '{"durability": 15, "climate_resistance": 10}', 'Protects against humidity and temperature changes.', 'uncommon', '[]', 200, 'luthiery_basic_technical', 3, 2, '🌡️'),
('Ironwood Treatment', 'durability', 3, '{"durability": 25, "structural_integrity": 15}', 'Deep-penetrating treatment that hardens the wood fibers.', 'rare', '[]', 600, 'luthiery_professional_technical', 5, 1, '🪨'),

-- Stage Presence enchantments
('Stage Glow', 'stage_presence', 1, '{"stage_presence": 5, "visual_appeal": 5}', 'Subtle LED accents that catch the light on stage.', 'common', '[]', 150, 'luthiery_basic_technical', 1, 2, '✨'),
('Showstopper Finish', 'stage_presence', 2, '{"stage_presence": 15, "visual_appeal": 10}', 'A dazzling refinish that commands attention under stage lights.', 'uncommon', '[]', 400, 'luthiery_basic_technical', 3, 2, '🌟'),
('Pyrotechnic Inlays', 'stage_presence', 3, '{"stage_presence": 25, "fame_boost": 5}', 'Custom fretboard inlays that glow and shimmer during performances.', 'rare', '[]', 900, 'luthiery_professional_technical', 6, 1, '🔮'),
('Legendary Aura', 'stage_presence', 4, '{"stage_presence": 35, "fame_boost": 15, "visual_appeal": 20}', 'An otherworldly presence emanates from this instrument — audiences are spellbound.', 'epic', '[]', 2500, 'luthiery_mastery_technical', 9, 1, '👁️'),

-- Fame enchantments
('Signature Series', 'fame', 2, '{"fame_per_gig": 5, "recognition": 10}', 'Brand the instrument as your signature model — fans take notice.', 'uncommon', '[]', 350, 'luthiery_basic_technical', 4, 1, '✍️'),
('Press Magnet', 'fame', 3, '{"fame_per_gig": 15, "media_attention": 10}', 'The media can''t stop talking about this instrument.', 'rare', '[]', 800, 'luthiery_professional_technical', 6, 1, '📰'),
('Icon Status', 'fame', 5, '{"fame_per_gig": 30, "recognition": 25, "legacy_points": 10}', 'This instrument becomes synonymous with your legacy.', 'legendary', '[]', 4000, 'luthiery_mastery_technical', 10, 1, '🏆'),

-- Luck enchantments
('Lucky Charm', 'luck', 1, '{"crit_chance": 3}', 'A small good-luck charm embedded in the headstock.', 'common', '[]', 120, 'luthiery_basic_technical', 1, 3, '🍀'),
('Fortune''s Favor', 'luck', 2, '{"crit_chance": 7, "bonus_roll": 5}', 'Fortune smiles on performances with this instrument.', 'uncommon', '[]', 300, 'luthiery_basic_technical', 3, 2, '🎲'),
('Serendipity Core', 'luck', 4, '{"crit_chance": 15, "bonus_roll": 10, "rare_drop_chance": 5}', 'Impossibly lucky — gig rewards and drops are significantly enhanced.', 'epic', '[]', 2000, 'luthiery_professional_technical', 8, 1, '⭐'),

-- Versatility enchantments
('Multi-Voice Mod', 'versatility', 2, '{"genre_flex": 10, "adaptability": 5}', 'Coil-tap and phase switching mods for tonal versatility.', 'uncommon', '[]', 280, 'luthiery_basic_technical', 3, 2, '🎚️'),
('Chameleon Circuit', 'versatility', 3, '{"genre_flex": 20, "adaptability": 15}', 'Advanced onboard EQ and switching — adapts to any genre instantly.', 'rare', '[]', 700, 'luthiery_professional_technical', 6, 1, '🦎'),
('Infinite Palette', 'versatility', 5, '{"genre_flex": 30, "adaptability": 25, "tone_warmth": 10, "tone_clarity": 10}', 'This instrument transcends genre boundaries — it can do anything.', 'legendary', '[]', 4500, 'luthiery_mastery_technical', 10, 1, '🎨');