-- Phase 1: Role Playing Enhancements Database Foundation

-- ============================================
-- CHARACTER ORIGINS (predefined starting archetypes)
-- ============================================
CREATE TABLE public.character_origins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  starting_cash INTEGER NOT NULL DEFAULT 100,
  starting_fame INTEGER NOT NULL DEFAULT 0,
  skill_bonuses JSONB NOT NULL DEFAULT '{}',
  reputation_modifiers JSONB NOT NULL DEFAULT '{}',
  unlock_requirements JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.character_origins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Character origins are viewable by everyone"
  ON public.character_origins FOR SELECT
  USING (true);

-- ============================================
-- PERSONALITY TRAITS (selectable traits affecting gameplay)
-- ============================================
CREATE TABLE public.personality_traits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('creative', 'social', 'work_ethic', 'emotional')),
  icon TEXT,
  gameplay_effects JSONB NOT NULL DEFAULT '{}',
  reputation_tendencies JSONB NOT NULL DEFAULT '{}',
  incompatible_with TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.personality_traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Personality traits are viewable by everyone"
  ON public.personality_traits FOR SELECT
  USING (true);

-- ============================================
-- PLAYER CHARACTER IDENTITY (player's RP choices)
-- ============================================
CREATE TABLE public.player_character_identity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin_id UUID REFERENCES public.character_origins(id),
  trait_ids UUID[] DEFAULT '{}',
  backstory_text TEXT,
  backstory_generated_at TIMESTAMPTZ,
  musical_style TEXT,
  career_goal TEXT,
  starting_city_id UUID REFERENCES public.cities(id),
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  custom_answers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE public.player_character_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own character identity"
  ON public.player_character_identity FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own character identity"
  ON public.player_character_identity FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own character identity"
  ON public.player_character_identity FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- ============================================
-- PLAYER REPUTATION (4-axis reputation tracking)
-- ============================================
CREATE TABLE public.player_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Authenticity axis: -100 (sell-out) to +100 (authentic)
  authenticity_score INTEGER NOT NULL DEFAULT 0 CHECK (authenticity_score >= -100 AND authenticity_score <= 100),
  -- Attitude axis: -100 (diva) to +100 (humble)
  attitude_score INTEGER NOT NULL DEFAULT 0 CHECK (attitude_score >= -100 AND attitude_score <= 100),
  -- Reliability axis: -100 (flaky) to +100 (dependable)
  reliability_score INTEGER NOT NULL DEFAULT 0 CHECK (reliability_score >= -100 AND reliability_score <= 100),
  -- Creativity axis: -100 (formulaic) to +100 (innovative)
  creativity_score INTEGER NOT NULL DEFAULT 0 CHECK (creativity_score >= -100 AND creativity_score <= 100),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE public.player_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reputation"
  ON public.player_reputation FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own reputation"
  ON public.player_reputation FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own reputation"
  ON public.player_reputation FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Public view for other players to see reputation (read-only)
CREATE POLICY "Reputation is viewable by authenticated users"
  ON public.player_reputation FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- REPUTATION EVENTS (history of reputation changes)
-- ============================================
CREATE TABLE public.reputation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  source_id UUID,
  axis TEXT NOT NULL CHECK (axis IN ('authenticity', 'attitude', 'reliability', 'creativity')),
  change_amount INTEGER NOT NULL,
  previous_value INTEGER NOT NULL,
  new_value INTEGER NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reputation events"
  ON public.reputation_events FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own reputation events"
  ON public.reputation_events FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_reputation_events_profile ON public.reputation_events(profile_id);
CREATE INDEX idx_reputation_events_created ON public.reputation_events(created_at DESC);

-- ============================================
-- NPC RELATIONSHIPS (dynamic NPC affinity tracking)
-- ============================================
CREATE TABLE public.npc_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  npc_type TEXT NOT NULL,
  npc_id UUID NOT NULL,
  npc_name TEXT NOT NULL,
  affinity_score INTEGER NOT NULL DEFAULT 0 CHECK (affinity_score >= -100 AND affinity_score <= 100),
  trust_score INTEGER NOT NULL DEFAULT 0 CHECK (trust_score >= -100 AND trust_score <= 100),
  respect_score INTEGER NOT NULL DEFAULT 0 CHECK (respect_score >= -100 AND respect_score <= 100),
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  relationship_stage TEXT NOT NULL DEFAULT 'stranger' CHECK (relationship_stage IN ('stranger', 'acquaintance', 'contact', 'ally', 'friend', 'rival', 'enemy')),
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, npc_type, npc_id)
);

ALTER TABLE public.npc_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own NPC relationships"
  ON public.npc_relationships FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own NPC relationships"
  ON public.npc_relationships FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own NPC relationships"
  ON public.npc_relationships FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_npc_relationships_profile ON public.npc_relationships(profile_id);
CREATE INDEX idx_npc_relationships_npc ON public.npc_relationships(npc_type, npc_id);

-- ============================================
-- SEED DATA: Character Origins
-- ============================================
INSERT INTO public.character_origins (key, name, tagline, description, icon, starting_cash, starting_fame, skill_bonuses, reputation_modifiers, display_order) VALUES
('street_busker', 'Street Busker', 'Earned every coin the hard way', 'You learned to play on street corners, subways, and sidewalks. Every tip was earned through raw talent and persistence. You know how to read a crowd and make strangers stop and listen.', 'guitar', 50, 5, '{"performance": 10, "vocals": 5}', '{"authenticity": 15, "reliability": 5}', 1),
('music_school_grad', 'Music School Graduate', 'Classically trained, hungry for more', 'Four years of theory, composition, and technique. You can read any chart and play any style—but the real world is different from the practice room.', 'graduation-cap', 200, 0, '{"technical": 15, "composition": 10, "songwriting": 5}', '{"creativity": 10}', 2),
('garage_band_vet', 'Garage Band Veteran', 'Born to jam with friends', 'You''ve been playing in basements and garages since you were a teenager. Band chemistry is in your blood, even if fame has been elusive.', 'users', 100, 10, '{"guitar": 10, "drums": 5, "performance": 5}', '{"reliability": 10, "attitude": 5}', 3),
('session_musician', 'Session Musician', 'The invisible professional', 'You''ve played on dozens of records without anyone knowing your name. Technical perfection is second nature, but it''s time to step into the spotlight.', 'music', 300, 0, '{"technical": 20, "guitar": 5, "bass": 5}', '{"reliability": 20}', 4),
('viral_sensation', 'Viral Sensation', 'Internet famous overnight', 'One video changed everything. Millions of views, but can you turn clicks into a real career? The pressure is on to prove you''re more than a one-hit wonder.', 'video', 150, 50, '{"creativity": 5, "performance": 5}', '{"authenticity": -10, "creativity": 10}', 5),
('industry_insider', 'Industry Insider', 'Connected from day one', 'You grew up around the music business—maybe a parent was a producer, or you interned at labels. You know how the game works, for better or worse.', 'briefcase', 500, 20, '{"songwriting": 5}', '{"authenticity": -15, "attitude": -10}', 6),
('classical_rebel', 'Classical Rebel', 'Conservatory dropout gone rogue', 'You were trained in the classics but the rules felt suffocating. Now you blend virtuosity with rebellion, creating something entirely your own.', 'piano', 150, 5, '{"technical": 10, "composition": 10, "creativity": 10}', '{"creativity": 20, "attitude": -5}', 7),
('local_legend', 'Local Legend', 'Big fish in a small pond', 'Everyone in your hometown knows your name. You''ve headlined every local venue and have a devoted fanbase—now it''s time to see if you can make it on the bigger stage.', 'crown', 200, 30, '{"performance": 10, "vocals": 5}', '{"authenticity": 10, "attitude": -5}', 8);

-- ============================================
-- SEED DATA: Personality Traits
-- ============================================
INSERT INTO public.personality_traits (key, name, description, category, icon, gameplay_effects, reputation_tendencies, incompatible_with, display_order) VALUES
-- Creative traits
('perfectionist', 'Perfectionist', 'You obsess over every detail until it''s just right.', 'creative', 'target', '{"song_quality_bonus": 0.1, "creation_time_multiplier": 1.3}', '{"creativity": 5}', '{"spontaneous"}', 1),
('spontaneous', 'Spontaneous', 'You trust your instincts and create in the moment.', 'creative', 'zap', '{"creation_time_multiplier": 0.7, "quality_variance": 0.2}', '{"creativity": 10, "reliability": -5}', '{"perfectionist"}', 2),
('experimental', 'Experimental', 'You push boundaries and try unconventional approaches.', 'creative', 'flask', '{"genre_fusion_bonus": 0.15, "mainstream_appeal_penalty": 0.1}', '{"creativity": 15, "authenticity": 5}', '{"traditionalist"}', 3),
('traditionalist', 'Traditionalist', 'You respect the classics and honor musical heritage.', 'creative', 'book', '{"genre_mastery_bonus": 0.1, "older_demographic_bonus": 0.2}', '{"authenticity": 10, "creativity": -5}', '{"experimental"}', 4),

-- Social traits
('diplomat', 'Diplomat', 'You know how to navigate conflicts and build bridges.', 'social', 'handshake', '{"negotiation_bonus": 0.15, "conflict_resolution_bonus": 0.2}', '{"attitude": 10, "reliability": 5}', '{"provocateur"}', 5),
('provocateur', 'Provocateur', 'You stir up controversy and aren''t afraid to make waves.', 'social', 'flame', '{"media_attention_bonus": 0.2, "controversy_chance": 0.15}', '{"authenticity": 5, "attitude": -15}', '{"diplomat"}', 6),
('networker', 'Networker', 'You collect contacts like trading cards and always know someone.', 'social', 'network', '{"connection_bonus": 0.2, "opportunity_discovery": 0.1}', '{"reliability": 5}', '{"introvert"}', 7),
('introvert', 'Introvert', 'You prefer intimate settings and deep connections over crowds.', 'social', 'user', '{"small_venue_bonus": 0.15, "large_venue_penalty": 0.1, "songwriting_bonus": 0.1}', '{"authenticity": 10}', '{"networker"}', 8),

-- Work ethic traits
('workaholic', 'Workaholic', 'You never stop grinding. Sleep is for the weak.', 'work_ethic', 'clock', '{"activity_speed_bonus": 0.15, "burnout_risk": 0.1}', '{"reliability": 15}', '{"hedonist"}', 9),
('hedonist', 'Hedonist', 'Life is for living. You work to play, not the other way around.', 'work_ethic', 'party-popper', '{"inspiration_bonus": 0.1, "energy_drain_penalty": 0.1}', '{"authenticity": 5, "reliability": -15}', '{"workaholic"}', 10),
('strategic', 'Strategic', 'You plan three moves ahead and never act without a reason.', 'work_ethic', 'chess', '{"resource_efficiency": 0.1, "opportunity_timing": 0.15}', '{"reliability": 10}', '{"spontaneous"}', 11),
('opportunist', 'Opportunist', 'You see chances others miss and seize them without hesitation.', 'work_ethic', 'sparkles', '{"random_opportunity_bonus": 0.2, "reputation_risk": 0.05}', '{"authenticity": -5}', '{}', 12),

-- Emotional traits
('thick_skinned', 'Thick Skinned', 'Criticism rolls off you like water off a duck.', 'emotional', 'shield', '{"negative_review_resistance": 0.5, "learning_from_feedback_penalty": 0.1}', '{"attitude": 5}', '{"sensitive"}', 13),
('sensitive', 'Sensitive Artist', 'You feel everything deeply—the highs and the lows.', 'emotional', 'heart', '{"inspiration_from_events": 0.2, "negative_event_impact": 1.3}', '{"authenticity": 10, "creativity": 5}', '{"thick_skinned"}', 14),
('competitive', 'Competitive', 'Second place is just the first loser. You play to win.', 'emotional', 'trophy', '{"chart_competition_bonus": 0.1, "rivalry_intensity": 1.2}', '{"attitude": -10}', '{"laid_back"}', 15),
('laid_back', 'Laid Back', 'You go with the flow and don''t sweat the small stuff.', 'emotional', 'coffee', '{"stress_resistance": 0.3, "urgency_penalty": 0.1}', '{"attitude": 15, "reliability": -5}', '{"competitive"}', 16);

-- ============================================
-- TRIGGER: Update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_rp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_character_origins_updated_at
  BEFORE UPDATE ON public.character_origins
  FOR EACH ROW EXECUTE FUNCTION update_rp_updated_at();

CREATE TRIGGER update_player_character_identity_updated_at
  BEFORE UPDATE ON public.player_character_identity
  FOR EACH ROW EXECUTE FUNCTION update_rp_updated_at();

CREATE TRIGGER update_npc_relationships_updated_at
  BEFORE UPDATE ON public.npc_relationships
  FOR EACH ROW EXECUTE FUNCTION update_rp_updated_at();