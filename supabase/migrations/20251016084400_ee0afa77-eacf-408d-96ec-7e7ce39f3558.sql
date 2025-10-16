-- Create band_stage_equipment table
CREATE TABLE public.band_stage_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  equipment_type VARCHAR NOT NULL,
  equipment_name VARCHAR NOT NULL,
  quality_rating INTEGER NOT NULL DEFAULT 50 CHECK (quality_rating >= 0 AND quality_rating <= 100),
  condition VARCHAR NOT NULL DEFAULT 'good',
  power_draw INTEGER,
  notes TEXT,
  purchase_date TIMESTAMP WITH TIME ZONE,
  purchase_cost INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create band_crew_members table
CREATE TABLE public.band_crew_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  crew_type VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  skill_level INTEGER NOT NULL DEFAULT 50 CHECK (skill_level >= 0 AND skill_level <= 100),
  salary_per_gig INTEGER NOT NULL DEFAULT 0,
  hire_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  experience_years INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create song_rehearsals table
CREATE TABLE public.song_rehearsals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  rehearsal_level INTEGER NOT NULL DEFAULT 0 CHECK (rehearsal_level >= 0 AND rehearsal_level <= 100),
  times_rehearsed INTEGER NOT NULL DEFAULT 0,
  last_rehearsed TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(song_id, band_id)
);

-- Create gig_song_performances table
CREATE TABLE public.gig_song_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  setlist_position INTEGER NOT NULL,
  performance_score NUMERIC NOT NULL DEFAULT 0,
  song_quality_contribution NUMERIC NOT NULL DEFAULT 0,
  rehearsal_contribution NUMERIC NOT NULL DEFAULT 0,
  chemistry_contribution NUMERIC NOT NULL DEFAULT 0,
  equipment_contribution NUMERIC NOT NULL DEFAULT 0,
  crew_contribution NUMERIC NOT NULL DEFAULT 0,
  member_skills_contribution NUMERIC NOT NULL DEFAULT 0,
  crowd_response VARCHAR NOT NULL DEFAULT 'mixed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gig_outcomes table
CREATE TABLE public.gig_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE UNIQUE,
  overall_rating NUMERIC NOT NULL DEFAULT 0,
  actual_attendance INTEGER NOT NULL DEFAULT 0,
  attendance_percentage NUMERIC NOT NULL DEFAULT 0,
  ticket_revenue INTEGER NOT NULL DEFAULT 0,
  merch_sales INTEGER NOT NULL DEFAULT 0,
  total_revenue INTEGER NOT NULL DEFAULT 0,
  crew_costs INTEGER NOT NULL DEFAULT 0,
  equipment_wear_cost INTEGER NOT NULL DEFAULT 0,
  net_profit INTEGER NOT NULL DEFAULT 0,
  fame_gained INTEGER NOT NULL DEFAULT 0,
  chemistry_impact INTEGER NOT NULL DEFAULT 0,
  breakdown_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create player_merchandise table
CREATE TABLE public.player_merchandise (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  item_type VARCHAR NOT NULL,
  design_name VARCHAR NOT NULL,
  cost_to_produce INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pre_gig_forecast to gigs table
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS pre_gig_forecast JSONB DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE public.band_stage_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_song_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_merchandise ENABLE ROW LEVEL SECURITY;

-- RLS Policies for band_stage_equipment
CREATE POLICY "Band members can view their equipment"
  ON public.band_stage_equipment FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can manage their equipment"
  ON public.band_stage_equipment FOR ALL
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for band_crew_members
CREATE POLICY "Band members can view their crew"
  ON public.band_crew_members FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can manage their crew"
  ON public.band_crew_members FOR ALL
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for song_rehearsals
CREATE POLICY "Band members can view song rehearsals"
  ON public.song_rehearsals FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can manage song rehearsals"
  ON public.song_rehearsals FOR ALL
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for gig_song_performances
CREATE POLICY "Band members can view their gig performances"
  ON public.gig_song_performances FOR SELECT
  USING (
    gig_id IN (
      SELECT id FROM public.gigs WHERE band_id IN (
        SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Band members can create gig performances"
  ON public.gig_song_performances FOR INSERT
  WITH CHECK (
    gig_id IN (
      SELECT id FROM public.gigs WHERE band_id IN (
        SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for gig_outcomes
CREATE POLICY "Band members can view their gig outcomes"
  ON public.gig_outcomes FOR SELECT
  USING (
    gig_id IN (
      SELECT id FROM public.gigs WHERE band_id IN (
        SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Band members can create gig outcomes"
  ON public.gig_outcomes FOR INSERT
  WITH CHECK (
    gig_id IN (
      SELECT id FROM public.gigs WHERE band_id IN (
        SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for player_merchandise
CREATE POLICY "Band members can view their merchandise"
  ON public.player_merchandise FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can manage their merchandise"
  ON public.player_merchandise FOR ALL
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_band_equipment_band_id ON public.band_stage_equipment(band_id);
CREATE INDEX idx_band_crew_band_id ON public.band_crew_members(band_id);
CREATE INDEX idx_song_rehearsals_song_band ON public.song_rehearsals(song_id, band_id);
CREATE INDEX idx_gig_performances_gig_id ON public.gig_song_performances(gig_id);
CREATE INDEX idx_gig_outcomes_gig_id ON public.gig_outcomes(gig_id);
CREATE INDEX idx_player_merch_band_id ON public.player_merchandise(band_id);

-- Add update triggers
CREATE TRIGGER update_band_equipment_updated_at
  BEFORE UPDATE ON public.band_stage_equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_band_crew_updated_at
  BEFORE UPDATE ON public.band_crew_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_song_rehearsals_updated_at
  BEFORE UPDATE ON public.song_rehearsals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_merch_updated_at
  BEFORE UPDATE ON public.player_merchandise
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();