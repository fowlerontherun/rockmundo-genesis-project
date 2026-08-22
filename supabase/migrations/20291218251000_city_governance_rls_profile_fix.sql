-- Follow-up hardening for accounts with multiple character profiles.
-- Replace scalar profile lookups with ownership EXISTS checks and remove direct
-- write policies now superseded by authoritative governance RPCs.

DROP POLICY IF EXISTS "Current mayors can update city laws" ON public.city_laws;
DROP POLICY IF EXISTS "Only mayors can update their city laws" ON public.city_laws;
CREATE POLICY "Current mayors can update city laws"
ON public.city_laws
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.city_mayors cm
    JOIN public.profiles p ON p.id = cm.profile_id
    WHERE cm.city_id = city_laws.city_id
      AND cm.is_current = true
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.city_mayors cm
    JOIN public.profiles p ON p.id = cm.profile_id
    WHERE cm.city_id = city_laws.city_id
      AND cm.is_current = true
      AND p.user_id = auth.uid()
  )
);

-- Project writes must go through propose_city_project/cancel_city_project and the
-- service-role completion worker. RLS no longer contains a second write path.
DROP POLICY IF EXISTS "Mayors can create projects in their city" ON public.city_projects;
DROP POLICY IF EXISTS "Mayors can update projects in their city" ON public.city_projects;

-- Registration inserts go through register_city_candidate. Candidate owners can
-- still withdraw/update their own candidate row without scalar-subquery failures.
DROP POLICY IF EXISTS "Users can register as candidates" ON public.city_candidates;
DROP POLICY IF EXISTS "Candidates can update their own registration" ON public.city_candidates;
CREATE POLICY "Candidates can update their own registration"
ON public.city_candidates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = city_candidates.profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = city_candidates.profile_id
      AND p.user_id = auth.uid()
  )
);

-- Voting inserts go through cast_city_election_vote. Keep vote privacy while
-- allowing every character owned by an account to read its own vote safely.
DROP POLICY IF EXISTS "Users can cast one vote per election" ON public.city_election_votes;
DROP POLICY IF EXISTS "Users can see their own votes" ON public.city_election_votes;
CREATE POLICY "Users can see their own votes"
ON public.city_election_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = city_election_votes.voter_profile_id
      AND p.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
