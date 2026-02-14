
CREATE POLICY "Users can update their own purchases"
  ON public.underworld_purchases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
