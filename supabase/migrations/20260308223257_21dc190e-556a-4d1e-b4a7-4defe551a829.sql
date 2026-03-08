-- Allow authenticated users to view any player's skill_progress (read-only)
CREATE POLICY "Authenticated users can view all skill progress"
ON public.skill_progress
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to view any player's attributes (read-only)
CREATE POLICY "Authenticated users can view all player attributes"
ON public.player_attributes
FOR SELECT
TO authenticated
USING (true);
