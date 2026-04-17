
-- =========================
-- 1. POLITICAL PARTIES
-- =========================
CREATE TABLE public.political_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  founder_profile_id UUID NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  colour_hex TEXT NOT NULL UNIQUE CHECK (colour_hex ~* '^#[0-9a-f]{6}$'),
  belief_1 TEXT,
  belief_2 TEXT,
  belief_3 TEXT,
  belief_4 TEXT,
  belief_5 TEXT,
  total_strength INTEGER NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 0,
  mayor_count INTEGER NOT NULL DEFAULT 0,
  treasury_balance BIGINT NOT NULL DEFAULT 0,
  founded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dissolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_political_parties_founder ON public.political_parties(founder_profile_id);
CREATE INDEX idx_political_parties_strength ON public.political_parties(total_strength DESC);

ALTER TABLE public.political_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties are publicly viewable" ON public.political_parties FOR SELECT USING (true);
CREATE POLICY "Profile owners can found parties" ON public.political_parties FOR INSERT
  WITH CHECK (founder_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Founders can update their party" ON public.political_parties FOR UPDATE
  USING (founder_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Founders can dissolve their party" ON public.political_parties FOR DELETE
  USING (founder_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- =========================
-- 2. PARTY MEMBERSHIPS
-- =========================
CREATE TABLE public.party_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.political_parties(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('founder','officer','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_party_memberships_party ON public.party_memberships(party_id);

ALTER TABLE public.party_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memberships are publicly viewable" ON public.party_memberships FOR SELECT USING (true);
CREATE POLICY "Profile owners can join parties" ON public.party_memberships FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Members can leave parties" ON public.party_memberships FOR DELETE
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.political_parties pp
      WHERE pp.id = party_memberships.party_id
        AND pp.founder_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Founders can update memberships" ON public.party_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.political_parties pp
      WHERE pp.id = party_memberships.party_id
        AND pp.founder_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.recompute_party_strength()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_party_id UUID;
BEGIN
  v_party_id := COALESCE(NEW.party_id, OLD.party_id);
  UPDATE public.political_parties pp
  SET member_count = (SELECT COUNT(*) FROM public.party_memberships WHERE party_id = v_party_id),
      mayor_count = (
        SELECT COUNT(*) FROM public.party_memberships pm
        JOIN public.city_mayors cm ON cm.profile_id = pm.profile_id AND cm.is_current = true
        WHERE pm.party_id = v_party_id
      ),
      total_strength = (SELECT COUNT(*)::int FROM public.party_memberships WHERE party_id = v_party_id) * 10
                     + (
                        SELECT COUNT(*)::int * 50 FROM public.party_memberships pm
                        JOIN public.city_mayors cm ON cm.profile_id = pm.profile_id AND cm.is_current = true
                        WHERE pm.party_id = v_party_id
                       ),
      updated_at = now()
  WHERE pp.id = v_party_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_party_membership_strength
AFTER INSERT OR DELETE OR UPDATE ON public.party_memberships
FOR EACH ROW EXECUTE FUNCTION public.recompute_party_strength();

CREATE OR REPLACE FUNCTION public.add_party_founder_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.party_memberships(party_id, profile_id, role)
  VALUES (NEW.id, NEW.founder_profile_id, 'founder')
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_party_founder_membership
AFTER INSERT ON public.political_parties
FOR EACH ROW EXECUTE FUNCTION public.add_party_founder_membership();

-- =========================
-- 3. WORLD PARLIAMENT MOTIONS & VOTES
-- =========================
CREATE TABLE public.world_parliament_motions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_mayor_id UUID NOT NULL,
  proposer_profile_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  motion_type TEXT NOT NULL CHECK (motion_type IN ('resolution','policy','budget','mayor_pay','treaty')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','passed','rejected','expired')),
  voting_opens_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voting_closes_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  yes_votes INTEGER NOT NULL DEFAULT 0,
  no_votes INTEGER NOT NULL DEFAULT 0,
  abstain_votes INTEGER NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_motions_status ON public.world_parliament_motions(status, voting_closes_at);

ALTER TABLE public.world_parliament_motions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motions are publicly viewable" ON public.world_parliament_motions FOR SELECT USING (true);
CREATE POLICY "Sitting mayors can propose motions" ON public.world_parliament_motions FOR INSERT
  WITH CHECK (
    proposer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.city_mayors cm
      WHERE cm.id = proposer_mayor_id
        AND cm.profile_id = proposer_profile_id
        AND cm.is_current = true
    )
  );

CREATE TABLE public.world_parliament_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id UUID NOT NULL REFERENCES public.world_parliament_motions(id) ON DELETE CASCADE,
  mayor_id UUID NOT NULL,
  voter_profile_id UUID NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('yes','no','abstain')),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(motion_id, mayor_id)
);

CREATE INDEX idx_motion_votes_motion ON public.world_parliament_votes(motion_id);

ALTER TABLE public.world_parliament_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are publicly viewable" ON public.world_parliament_votes FOR SELECT USING (true);
CREATE POLICY "Sitting mayors can cast votes" ON public.world_parliament_votes FOR INSERT
  WITH CHECK (
    voter_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.city_mayors cm
      WHERE cm.id = mayor_id
        AND cm.profile_id = voter_profile_id
        AND cm.is_current = true
    )
  );

CREATE OR REPLACE FUNCTION public.update_motion_tallies()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_motion_id UUID;
BEGIN
  v_motion_id := COALESCE(NEW.motion_id, OLD.motion_id);
  UPDATE public.world_parliament_motions m
  SET yes_votes = (SELECT COUNT(*) FROM public.world_parliament_votes WHERE motion_id = v_motion_id AND vote='yes'),
      no_votes = (SELECT COUNT(*) FROM public.world_parliament_votes WHERE motion_id = v_motion_id AND vote='no'),
      abstain_votes = (SELECT COUNT(*) FROM public.world_parliament_votes WHERE motion_id = v_motion_id AND vote='abstain')
  WHERE m.id = v_motion_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_motion_vote_tally
AFTER INSERT OR DELETE OR UPDATE ON public.world_parliament_votes
FOR EACH ROW EXECUTE FUNCTION public.update_motion_tallies();

-- =========================
-- 4. MAYOR PAY SETTINGS & PAYMENTS
-- =========================
CREATE TABLE public.mayor_pay_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weekly_salary_per_mayor BIGINT NOT NULL DEFAULT 1500000,
  min_salary BIGINT NOT NULL DEFAULT 500000,
  max_salary BIGINT NOT NULL DEFAULT 5000000,
  last_motion_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.mayor_pay_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.mayor_pay_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pay settings are publicly viewable" ON public.mayor_pay_settings FOR SELECT USING (true);

CREATE TABLE public.mayor_salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mayor_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  city_id UUID NOT NULL,
  amount BIGINT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  week_of DATE NOT NULL DEFAULT (current_date - extract(dow FROM current_date)::int)
);

CREATE INDEX idx_mayor_salary_payments_profile ON public.mayor_salary_payments(profile_id, paid_at DESC);

ALTER TABLE public.mayor_salary_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salary payments are publicly viewable" ON public.mayor_salary_payments FOR SELECT USING (true);

-- =========================
-- 5. CITY CANDIDATE EXTENSIONS
-- =========================
ALTER TABLE public.city_candidates
  ADD COLUMN IF NOT EXISTS nominator_profile_id UUID,
  ADD COLUMN IF NOT EXISTS seconder_profile_id UUID,
  ADD COLUMN IF NOT EXISTS nominated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seconded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES public.political_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_article TEXT,
  ADD COLUMN IF NOT EXISTS campaign_spend_total BIGINT NOT NULL DEFAULT 0;

-- =========================
-- 6. CAMPAIGN EXPENDITURES
-- =========================
CREATE TABLE public.campaign_expenditures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.city_candidates(id) ON DELETE CASCADE,
  spender_profile_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ads','rallies','staff','media','merch')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  effect_value INTEGER NOT NULL DEFAULT 0,
  funded_from TEXT NOT NULL DEFAULT 'personal' CHECK (funded_from IN ('personal','party')),
  party_id UUID REFERENCES public.political_parties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_exp_candidate ON public.campaign_expenditures(candidate_id);

ALTER TABLE public.campaign_expenditures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Expenditures are publicly viewable" ON public.campaign_expenditures FOR SELECT USING (true);
CREATE POLICY "Spenders log their own spending" ON public.campaign_expenditures FOR INSERT
  WITH CHECK (spender_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- =========================
-- 7. ELECTION NEWS ARTICLES
-- =========================
CREATE TABLE public.election_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.city_elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.city_candidates(id) ON DELETE CASCADE,
  author_profile_id UUID NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_election_articles_election ON public.election_news_articles(election_id, published_at DESC);

ALTER TABLE public.election_news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Election articles are publicly viewable" ON public.election_news_articles FOR SELECT USING (true);
CREATE POLICY "Candidates publish their own articles" ON public.election_news_articles FOR INSERT
  WITH CHECK (
    author_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.city_candidates cc
      WHERE cc.id = candidate_id AND cc.profile_id = author_profile_id
    )
  );
CREATE POLICY "Authors can edit their articles" ON public.election_news_articles FOR UPDATE
  USING (author_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- =========================
-- 8. POLITICS SKILLS SEED
-- =========================
INSERT INTO public.skill_definitions (slug, display_name, description)
VALUES
  ('professional_party_management','Party Management','Reduces party operating costs and raises member cap'),
  ('master_oratory','Oratory','Boosts campaign reach and parliament persuasion')
ON CONFLICT (slug) DO NOTHING;

-- =========================
-- 9. updated_at trigger
-- =========================
CREATE TRIGGER trg_political_parties_updated
BEFORE UPDATE ON public.political_parties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
