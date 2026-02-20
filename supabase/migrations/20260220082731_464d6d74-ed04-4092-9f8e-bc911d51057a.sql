
-- =====================================================
-- ENHANCED BAND CHEMISTRY SYSTEM
-- 4-axis chemistry with drama events
-- =====================================================

-- Add new chemistry dimensions to bands table
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS romantic_tension INTEGER NOT NULL DEFAULT 0 CHECK (romantic_tension >= 0 AND romantic_tension <= 100),
  ADD COLUMN IF NOT EXISTS creative_alignment INTEGER NOT NULL DEFAULT 50 CHECK (creative_alignment >= 0 AND creative_alignment <= 100),
  ADD COLUMN IF NOT EXISTS conflict_index INTEGER NOT NULL DEFAULT 0 CHECK (conflict_index >= 0 AND conflict_index <= 100),
  ADD COLUMN IF NOT EXISTS drama_cooldown_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_drama_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chemistry_modifiers JSONB DEFAULT '{}';

-- Band drama events table
CREATE TABLE public.band_drama_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  
  -- What happened
  drama_type TEXT NOT NULL CHECK (drama_type IN (
    'romantic_breakup', 'romantic_tension', 'affair_scandal',
    'creative_clash', 'genre_disagreement', 'songwriting_dispute',
    'rivalry_eruption', 'jealousy_incident', 'leadership_challenge',
    'public_scandal', 'media_fallout', 'fan_backlash',
    'member_threat_leave', 'member_ultimatum', 'intervention',
    'reconciliation', 'creative_breakthrough', 'unity_moment'
  )),
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
  
  -- Score impacts
  chemistry_change INTEGER DEFAULT 0,
  romantic_tension_change INTEGER DEFAULT 0,
  creative_alignment_change INTEGER DEFAULT 0,
  conflict_index_change INTEGER DEFAULT 0,
  
  -- Who's involved
  instigator_member_id UUID REFERENCES public.band_members(id),
  target_member_id UUID REFERENCES public.band_members(id),
  
  -- Consequences
  member_leave_risk INTEGER DEFAULT 0 CHECK (member_leave_risk >= 0 AND member_leave_risk <= 100),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolution_type TEXT, -- 'apologized', 'ignored', 'escalated', 'band_vote', 'leader_decision'
  resolved_at TIMESTAMPTZ,
  
  -- Context
  description TEXT,
  public_knowledge BOOLEAN NOT NULL DEFAULT false,
  media_coverage BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_drama_events_band ON public.band_drama_events(band_id);
CREATE INDEX idx_drama_events_type ON public.band_drama_events(drama_type);
CREATE INDEX idx_drama_events_unresolved ON public.band_drama_events(band_id) WHERE resolved = false;
CREATE INDEX idx_drama_events_severity ON public.band_drama_events(severity);

-- RLS
ALTER TABLE public.band_drama_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view their drama events"
ON public.band_drama_events FOR SELECT
USING (band_id IN (
  SELECT band_id FROM public.band_members
  WHERE user_id = auth.uid()
));

CREATE POLICY "Band members can insert drama events"
ON public.band_drama_events FOR INSERT
WITH CHECK (band_id IN (
  SELECT band_id FROM public.band_members
  WHERE user_id = auth.uid()
));

CREATE POLICY "Band members can update their drama events"
ON public.band_drama_events FOR UPDATE
USING (band_id IN (
  SELECT band_id FROM public.band_members
  WHERE user_id = auth.uid()
));

CREATE POLICY "Service role full access drama events"
ON public.band_drama_events FOR ALL
USING (auth.role() = 'service_role');
