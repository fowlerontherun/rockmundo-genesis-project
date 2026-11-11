-- Hide every award receipt from public and signed-in clients until the
-- authoritative settlement transaction marks the parent show completed.
CREATE POLICY "Award winners require a completed show"
ON public.award_wins AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.award_shows s
  WHERE s.id = award_wins.award_show_id AND s.status = 'completed'
));
