
-- =====================================================
-- ROMANTIC PROGRESSION SYSTEM
-- Stages, compatibility, affair detection
-- =====================================================

-- Core romantic relationship table
CREATE TABLE public.romantic_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- The two parties (always player profiles or NPCs)
  partner_a_id UUID NOT NULL,
  partner_a_type TEXT NOT NULL DEFAULT 'player' CHECK (partner_a_type IN ('player', 'npc')),
  partner_b_id UUID NOT NULL,
  partner_b_type TEXT NOT NULL DEFAULT 'player' CHECK (partner_b_type IN ('player', 'npc')),
  partner_b_name TEXT NOT NULL DEFAULT '',
  
  -- Current stage
  stage TEXT NOT NULL DEFAULT 'flirting' CHECK (stage IN (
    'flirting', 'dating', 'exclusive', 'public_relationship',
    'engaged', 'married', 'separated', 'divorced', 'secret_affair'
  )),
  
  -- Scores
  attraction_score INTEGER NOT NULL DEFAULT 50 CHECK (attraction_score >= 0 AND attraction_score <= 100),
  compatibility_score INTEGER NOT NULL DEFAULT 50 CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  passion_score INTEGER NOT NULL DEFAULT 50 CHECK (passion_score >= 0 AND passion_score <= 100),
  commitment_score INTEGER NOT NULL DEFAULT 0 CHECK (commitment_score >= 0 AND commitment_score <= 100),
  tension_score INTEGER NOT NULL DEFAULT 0 CHECK (tension_score >= 0 AND tension_score <= 100),
  
  -- Affair tracking
  is_secret BOOLEAN NOT NULL DEFAULT false,
  affair_suspicion INTEGER NOT NULL DEFAULT 0 CHECK (affair_suspicion >= 0 AND affair_suspicion <= 100),
  affair_detected BOOLEAN NOT NULL DEFAULT false,
  affair_detected_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  initiated_by UUID,
  ended_by UUID,
  end_reason TEXT, -- 'mutual', 'rejection', 'affair_caught', 'incompatible', 'abandoned'
  
  -- Timestamps
  stage_changed_at TIMESTAMPTZ DEFAULT now(),
  last_date_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}',
  
  UNIQUE (partner_a_id, partner_b_id, partner_b_type)
);

-- Romance event log
CREATE TABLE public.romantic_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  romance_id UUID NOT NULL REFERENCES public.romantic_relationships(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'stage_advance', 'stage_regress', 'date', 'argument', 'gift', 'affair_suspicion', 'proposal', 'rejection', etc.
  old_stage TEXT,
  new_stage TEXT,
  
  -- Score changes
  attraction_change INTEGER DEFAULT 0,
  passion_change INTEGER DEFAULT 0,
  commitment_change INTEGER DEFAULT 0,
  tension_change INTEGER DEFAULT 0,
  suspicion_change INTEGER DEFAULT 0,
  
  -- Reputation impact
  reputation_axis TEXT, -- 'authenticity', 'attitude', 'reliability', 'creativity'
  reputation_change INTEGER DEFAULT 0,
  
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_romantic_rel_a ON public.romantic_relationships(partner_a_id);
CREATE INDEX idx_romantic_rel_b ON public.romantic_relationships(partner_b_id, partner_b_type);
CREATE INDEX idx_romantic_rel_stage ON public.romantic_relationships(stage);
CREATE INDEX idx_romantic_rel_active ON public.romantic_relationships(is_active);
CREATE INDEX idx_romantic_rel_affair ON public.romantic_relationships(is_secret) WHERE is_secret = true;
CREATE INDEX idx_romantic_events_romance ON public.romantic_events(romance_id);

-- RLS
ALTER TABLE public.romantic_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.romantic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own romances"
ON public.romantic_relationships FOR SELECT
USING (
  partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR partner_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Players can insert own romances"
ON public.romantic_relationships FOR INSERT
WITH CHECK (partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own romances"
ON public.romantic_relationships FOR UPDATE
USING (partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can view own romance events"
ON public.romantic_events FOR SELECT
USING (romance_id IN (
  SELECT id FROM public.romantic_relationships 
  WHERE partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
     OR partner_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Players can insert own romance events"
ON public.romantic_events FOR INSERT
WITH CHECK (romance_id IN (
  SELECT id FROM public.romantic_relationships 
  WHERE partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
));

-- Service role
CREATE POLICY "Service role full access romances"
ON public.romantic_relationships FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access romance events"
ON public.romantic_events FOR ALL
USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_romantic_relationships_updated_at
BEFORE UPDATE ON public.romantic_relationships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
