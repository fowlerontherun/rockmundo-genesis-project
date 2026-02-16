-- Allow all authenticated users to view gig outcomes (public performance data, no sensitive info)
DROP POLICY IF EXISTS gig_outcomes_select ON public.gig_outcomes;
CREATE POLICY gig_outcomes_select ON public.gig_outcomes FOR SELECT
USING (true);