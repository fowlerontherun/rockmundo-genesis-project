-- Allow authenticated users to insert/update/delete practice track audio records
CREATE POLICY "Authenticated insert practice track audio"
  ON public.practice_track_audio FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update practice track audio"
  ON public.practice_track_audio FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated delete practice track audio"
  ON public.practice_track_audio FOR DELETE
  TO authenticated
  USING (true);