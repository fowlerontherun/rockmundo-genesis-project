
-- =====================================================
-- UNIFIED CHARACTER RELATIONSHIP SYSTEM
-- Supports: Player↔Player, Player↔NPC, Player↔Band
-- =====================================================

-- Main relationship table
CREATE TABLE public.character_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Entity A (always a player profile)
  entity_a_id UUID NOT NULL,
  entity_a_type TEXT NOT NULL DEFAULT 'player' CHECK (entity_a_type IN ('player')),
  
  -- Entity B (player, npc, or band)
  entity_b_id UUID NOT NULL,
  entity_b_type TEXT NOT NULL CHECK (entity_b_type IN ('player', 'npc', 'band')),
  entity_b_name TEXT NOT NULL DEFAULT '',
  
  -- Relationship types (supports multiple simultaneous)
  relationship_types TEXT[] NOT NULL DEFAULT '{"acquaintance"}',
  
  -- Core scores
  affection_score INTEGER NOT NULL DEFAULT 0 CHECK (affection_score >= -100 AND affection_score <= 100),
  trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  attraction_score INTEGER NOT NULL DEFAULT 0 CHECK (attraction_score >= 0 AND attraction_score <= 100),
  loyalty_score INTEGER NOT NULL DEFAULT 50 CHECK (loyalty_score >= 0 AND loyalty_score <= 100),
  jealousy_score INTEGER NOT NULL DEFAULT 0 CHECK (jealousy_score >= 0 AND jealousy_score <= 100),
  
  -- Visibility
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends_only', 'public', 'leaked')),
  
  -- Timestamps
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  last_decay_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}',
  
  -- Prevent duplicate relationships
  UNIQUE (entity_a_id, entity_b_id, entity_b_type)
);

-- Interaction history log
CREATE TABLE public.relationship_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES public.character_relationships(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  description TEXT,
  
  -- Score changes from this interaction
  affection_change INTEGER DEFAULT 0,
  trust_change INTEGER DEFAULT 0,
  attraction_change INTEGER DEFAULT 0,
  loyalty_change INTEGER DEFAULT 0,
  jealousy_change INTEGER DEFAULT 0,
  
  -- Who initiated
  initiated_by UUID,
  
  -- Context
  context_type TEXT, -- 'gig', 'chat', 'trade', 'gift', 'conflict', etc.
  context_id TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relationship event hooks log (threshold crossings)
CREATE TABLE public.relationship_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES public.character_relationships(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'threshold_crossed', 'type_changed', 'visibility_changed', 'decay_warning'
  event_key TEXT NOT NULL, -- e.g. 'trust_high', 'affection_negative', 'became_rival'
  score_name TEXT,
  old_value INTEGER,
  new_value INTEGER,
  threshold INTEGER,
  message TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_char_rel_entity_a ON public.character_relationships(entity_a_id);
CREATE INDEX idx_char_rel_entity_b ON public.character_relationships(entity_b_id, entity_b_type);
CREATE INDEX idx_char_rel_last_interaction ON public.character_relationships(last_interaction_at);
CREATE INDEX idx_char_rel_decay ON public.character_relationships(last_decay_at);
CREATE INDEX idx_rel_interactions_rel ON public.relationship_interactions(relationship_id);
CREATE INDEX idx_rel_interactions_created ON public.relationship_interactions(created_at);
CREATE INDEX idx_rel_events_rel ON public.relationship_events(relationship_id);
CREATE INDEX idx_rel_events_unprocessed ON public.relationship_events(processed) WHERE processed = false;

-- Enable RLS
ALTER TABLE public.character_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_events ENABLE ROW LEVEL SECURITY;

-- RLS: Players can see their own relationships
CREATE POLICY "Players can view own relationships"
ON public.character_relationships FOR SELECT
USING (entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert own relationships"
ON public.character_relationships FOR INSERT
WITH CHECK (entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own relationships"
ON public.character_relationships FOR UPDATE
USING (entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can delete own relationships"
ON public.character_relationships FOR DELETE
USING (entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS: Interaction logs follow parent relationship
CREATE POLICY "Players can view own interaction logs"
ON public.relationship_interactions FOR SELECT
USING (relationship_id IN (
  SELECT id FROM public.character_relationships 
  WHERE entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Players can insert own interaction logs"
ON public.relationship_interactions FOR INSERT
WITH CHECK (relationship_id IN (
  SELECT id FROM public.character_relationships 
  WHERE entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
));

-- RLS: Events follow parent relationship
CREATE POLICY "Players can view own relationship events"
ON public.relationship_events FOR SELECT
USING (relationship_id IN (
  SELECT id FROM public.character_relationships 
  WHERE entity_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
));

-- Service role policy for edge functions (decay cron)
CREATE POLICY "Service role full access to relationships"
ON public.character_relationships FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to interactions"
ON public.relationship_interactions FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to events"
ON public.relationship_events FOR ALL
USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_character_relationships_updated_at
BEFORE UPDATE ON public.character_relationships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
