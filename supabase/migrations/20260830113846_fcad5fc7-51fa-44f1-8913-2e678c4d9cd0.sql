-- city_laws update
DROP POLICY IF EXISTS "Current mayors can update city laws" ON public.city_laws;
CREATE POLICY "Current mayors can update city laws"
ON public.city_laws FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.city_mayors cm
  WHERE cm.city_id = city_laws.city_id
    AND cm.is_current = true
    AND cm.profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
));

-- city_candidates
DROP POLICY IF EXISTS "Users can register as candidates" ON public.city_candidates;
CREATE POLICY "Users can register as candidates"
ON public.city_candidates FOR INSERT
WITH CHECK (profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Candidates can update their own registration" ON public.city_candidates;
CREATE POLICY "Candidates can update their own registration"
ON public.city_candidates FOR UPDATE
USING (profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Candidates can withdraw" ON public.city_candidates;
CREATE POLICY "Candidates can withdraw"
ON public.city_candidates FOR DELETE
USING (profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- city_election_votes
DROP POLICY IF EXISTS "Users can cast one vote per election" ON public.city_election_votes;
CREATE POLICY "Users can cast one vote per election"
ON public.city_election_votes FOR INSERT
WITH CHECK (voter_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can see their own votes" ON public.city_election_votes;
CREATE POLICY "Users can see their own votes"
ON public.city_election_votes FOR SELECT
USING (voter_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- sponsorship_entities
DROP POLICY IF EXISTS "Users can view their own sponsorship entities" ON public.sponsorship_entities;
CREATE POLICY "Users can view their own sponsorship entities"
ON public.sponsorship_entities FOR SELECT
USING (
  band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.user_id = auth.uid())
  OR artist_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- sponsorship_notifications
DROP POLICY IF EXISTS "Users can view their sponsorship notifications" ON public.sponsorship_notifications;
CREATE POLICY "Users can view their sponsorship notifications"
ON public.sponsorship_notifications FOR SELECT
USING (entity_id IN (
  SELECT se.id FROM public.sponsorship_entities se
  WHERE se.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.user_id = auth.uid())
     OR se.artist_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
));