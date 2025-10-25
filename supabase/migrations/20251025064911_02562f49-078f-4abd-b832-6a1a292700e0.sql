-- Drop existing tables if they have wrong schema
DROP TABLE IF EXISTS public.gig_song_performances CASCADE;
DROP TABLE IF EXISTS public.gig_outcomes CASCADE;

-- Add gig outcomes table
CREATE TABLE public.gig_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  actual_attendance INTEGER NOT NULL,
  attendance_percentage NUMERIC(5,2),
  ticket_revenue INTEGER NOT NULL DEFAULT 0,
  merch_revenue INTEGER NOT NULL DEFAULT 0,
  total_revenue INTEGER NOT NULL DEFAULT 0,
  venue_cost INTEGER NOT NULL DEFAULT 0,
  crew_cost INTEGER NOT NULL DEFAULT 0,
  equipment_cost INTEGER NOT NULL DEFAULT 0,
  total_costs INTEGER NOT NULL DEFAULT 0,
  net_profit INTEGER NOT NULL DEFAULT 0,
  overall_rating NUMERIC(4,2) NOT NULL,
  performance_grade TEXT,
  equipment_quality_avg INTEGER DEFAULT 0,
  crew_skill_avg INTEGER DEFAULT 0,
  band_chemistry_level INTEGER DEFAULT 0,
  member_skill_avg NUMERIC(5,2) DEFAULT 0,
  fame_gained INTEGER DEFAULT 0,
  chemistry_change INTEGER DEFAULT 0,
  merch_items_sold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add gig song performances
CREATE TABLE public.gig_song_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_outcome_id UUID NOT NULL REFERENCES public.gig_outcomes(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  performance_score NUMERIC(4,2) NOT NULL,
  crowd_response TEXT NOT NULL,
  song_quality_contrib NUMERIC(4,2),
  rehearsal_contrib NUMERIC(4,2),
  chemistry_contrib NUMERIC(4,2),
  equipment_contrib NUMERIC(4,2),
  crew_contrib NUMERIC(4,2),
  member_skill_contrib NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add hype fields to songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS hype INTEGER DEFAULT 0;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS total_radio_plays INTEGER DEFAULT 0;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS last_radio_play TIMESTAMPTZ;

-- Add indexes
CREATE INDEX idx_gig_outcomes_gig_id ON public.gig_outcomes(gig_id);
CREATE INDEX idx_gig_song_performances_outcome ON public.gig_song_performances(gig_outcome_id);
CREATE INDEX IF NOT EXISTS idx_songs_hype ON public.songs(hype DESC) WHERE hype > 0;

-- Enable RLS
ALTER TABLE public.gig_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_song_performances ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY gig_outcomes_select ON public.gig_outcomes FOR SELECT
USING (gig_id IN (SELECT g.id FROM public.gigs g INNER JOIN public.band_members bm ON bm.band_id = g.band_id WHERE bm.user_id = auth.uid()));

CREATE POLICY gig_song_performances_select ON public.gig_song_performances FOR SELECT
USING (gig_outcome_id IN (SELECT go.id FROM public.gig_outcomes go INNER JOIN public.gigs g ON g.id = go.gig_id INNER JOIN public.band_members bm ON bm.band_id = g.band_id WHERE bm.user_id = auth.uid()));