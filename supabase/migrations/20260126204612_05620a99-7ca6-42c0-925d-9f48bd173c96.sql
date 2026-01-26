-- Create enums for city governance
CREATE TYPE drug_policy_status AS ENUM ('prohibited', 'medical_only', 'decriminalized', 'legalized');
CREATE TYPE election_status AS ENUM ('nomination', 'voting', 'completed', 'cancelled');
CREATE TYPE candidate_status AS ENUM ('pending', 'approved', 'withdrawn', 'disqualified');

-- City Mayors table (created first as city_laws references it)
CREATE TABLE public.city_mayors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  term_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_end TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT false,
  election_id UUID,
  approval_rating NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  policies_enacted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- City Laws table
CREATE TABLE public.city_laws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  income_tax_rate NUMERIC(4,2) NOT NULL DEFAULT 10.0 CHECK (income_tax_rate >= 5.0 AND income_tax_rate <= 25.0),
  sales_tax_rate NUMERIC(4,2) NOT NULL DEFAULT 8.0 CHECK (sales_tax_rate >= 0.0 AND sales_tax_rate <= 15.0),
  travel_tax NUMERIC(8,2) NOT NULL DEFAULT 50.0 CHECK (travel_tax >= 0.0),
  alcohol_legal_age INTEGER NOT NULL DEFAULT 21 CHECK (alcohol_legal_age >= 16 AND alcohol_legal_age <= 25),
  drug_policy drug_policy_status NOT NULL DEFAULT 'prohibited',
  noise_curfew_hour INTEGER CHECK (noise_curfew_hour IS NULL OR (noise_curfew_hour >= 20 AND noise_curfew_hour <= 26)),
  busking_license_fee NUMERIC(8,2) NOT NULL DEFAULT 0.0 CHECK (busking_license_fee >= 0.0),
  venue_permit_cost NUMERIC(8,2) NOT NULL DEFAULT 500.0 CHECK (venue_permit_cost >= 0.0),
  prohibited_genres TEXT[] NOT NULL DEFAULT '{}',
  promoted_genres TEXT[] NOT NULL DEFAULT '{}',
  festival_permit_required BOOLEAN NOT NULL DEFAULT true,
  max_concert_capacity INTEGER,
  community_events_funding NUMERIC(8,2) NOT NULL DEFAULT 0.0 CHECK (community_events_funding >= 0.0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  enacted_by_mayor_id UUID REFERENCES public.city_mayors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_active_city_laws UNIQUE (city_id, effective_until)
);

-- City Elections table
CREATE TABLE public.city_elections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  election_year INTEGER NOT NULL,
  status election_status NOT NULL DEFAULT 'nomination',
  nomination_start TIMESTAMPTZ NOT NULL,
  nomination_end TIMESTAMPTZ NOT NULL,
  voting_start TIMESTAMPTZ NOT NULL,
  voting_end TIMESTAMPTZ NOT NULL,
  winner_id UUID,
  total_votes INTEGER NOT NULL DEFAULT 0,
  voter_turnout_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_city_election_year UNIQUE (city_id, election_year)
);

-- Add foreign key from city_mayors to city_elections now that it exists
ALTER TABLE public.city_mayors 
  ADD CONSTRAINT city_mayors_election_id_fkey 
  FOREIGN KEY (election_id) REFERENCES public.city_elections(id) ON DELETE SET NULL;

-- City Candidates table
CREATE TABLE public.city_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.city_elections(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_slogan TEXT,
  proposed_policies JSONB NOT NULL DEFAULT '{}',
  campaign_budget NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  endorsements TEXT[] NOT NULL DEFAULT '{}',
  vote_count INTEGER NOT NULL DEFAULT 0,
  status candidate_status NOT NULL DEFAULT 'pending',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_candidate_per_election UNIQUE (election_id, profile_id)
);

-- Add foreign key from city_elections to city_candidates for winner
ALTER TABLE public.city_elections 
  ADD CONSTRAINT city_elections_winner_id_fkey 
  FOREIGN KEY (winner_id) REFERENCES public.city_candidates(id) ON DELETE SET NULL;

-- City Election Votes table
CREATE TABLE public.city_election_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.city_elections(id) ON DELETE CASCADE,
  voter_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.city_candidates(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_vote_per_election UNIQUE (election_id, voter_profile_id)
);

-- City Law History table (audit trail)
CREATE TABLE public.city_law_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  mayor_id UUID REFERENCES public.city_mayors(id) ON DELETE SET NULL,
  law_field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  change_reason TEXT,
  game_year INTEGER,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_city_laws_city_id ON public.city_laws(city_id);
CREATE INDEX idx_city_laws_effective ON public.city_laws(city_id, effective_from, effective_until);
CREATE INDEX idx_city_mayors_city_current ON public.city_mayors(city_id, is_current) WHERE is_current = true;
CREATE INDEX idx_city_mayors_profile ON public.city_mayors(profile_id);
CREATE INDEX idx_city_elections_city_status ON public.city_elections(city_id, status);
CREATE INDEX idx_city_elections_year ON public.city_elections(city_id, election_year);
CREATE INDEX idx_city_candidates_election ON public.city_candidates(election_id);
CREATE INDEX idx_city_candidates_profile ON public.city_candidates(profile_id);
CREATE INDEX idx_city_election_votes_election ON public.city_election_votes(election_id);
CREATE INDEX idx_city_election_votes_candidate ON public.city_election_votes(candidate_id);
CREATE INDEX idx_city_law_history_city ON public.city_law_history(city_id);

-- Enable RLS on all tables
ALTER TABLE public.city_laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_mayors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_election_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_law_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for city_laws (publicly readable)
CREATE POLICY "City laws are publicly readable"
  ON public.city_laws FOR SELECT
  USING (true);

CREATE POLICY "Only mayors can update their city laws"
  ON public.city_laws FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.city_mayors cm
      WHERE cm.id = city_laws.enacted_by_mayor_id
      AND cm.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      AND cm.is_current = true
    )
  );

CREATE POLICY "System can insert city laws"
  ON public.city_laws FOR INSERT
  WITH CHECK (true);

-- RLS Policies for city_mayors (publicly readable)
CREATE POLICY "City mayors are publicly readable"
  ON public.city_mayors FOR SELECT
  USING (true);

CREATE POLICY "System can manage mayors"
  ON public.city_mayors FOR ALL
  USING (true);

-- RLS Policies for city_elections (publicly readable)
CREATE POLICY "City elections are publicly readable"
  ON public.city_elections FOR SELECT
  USING (true);

CREATE POLICY "System can manage elections"
  ON public.city_elections FOR ALL
  USING (true);

-- RLS Policies for city_candidates
CREATE POLICY "Candidates are publicly readable"
  ON public.city_candidates FOR SELECT
  USING (true);

CREATE POLICY "Users can register as candidates"
  ON public.city_candidates FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Candidates can update their own registration"
  ON public.city_candidates FOR UPDATE
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Candidates can withdraw"
  ON public.city_candidates FOR DELETE
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for city_election_votes
CREATE POLICY "Users can see their own votes"
  ON public.city_election_votes FOR SELECT
  USING (
    voter_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can cast one vote per election"
  ON public.city_election_votes FOR INSERT
  WITH CHECK (
    voter_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for city_law_history (publicly readable)
CREATE POLICY "Law history is publicly readable"
  ON public.city_law_history FOR SELECT
  USING (true);

CREATE POLICY "System can insert law history"
  ON public.city_law_history FOR INSERT
  WITH CHECK (true);

-- Function to update vote counts when a vote is cast
CREATE OR REPLACE FUNCTION public.update_candidate_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment vote count for the candidate
  UPDATE public.city_candidates
  SET vote_count = vote_count + 1
  WHERE id = NEW.candidate_id;
  
  -- Update total votes for the election
  UPDATE public.city_elections
  SET total_votes = total_votes + 1
  WHERE id = NEW.election_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for vote counting
CREATE TRIGGER on_vote_cast
  AFTER INSERT ON public.city_election_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_candidate_vote_count();

-- Function to update city_laws updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_city_laws_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_city_laws_timestamp
  BEFORE UPDATE ON public.city_laws
  FOR EACH ROW
  EXECUTE FUNCTION public.update_city_laws_updated_at();