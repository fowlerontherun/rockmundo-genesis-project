
-- Allow authenticated users to insert lottery draws (creates pending draw for current week)
CREATE POLICY "Authenticated users can create lottery draws"
ON public.lottery_draws FOR INSERT
TO authenticated
WITH CHECK (status = 'pending');
