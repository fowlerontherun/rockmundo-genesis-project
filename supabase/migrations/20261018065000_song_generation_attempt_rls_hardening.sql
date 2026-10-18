-- #4282 / follow-up to #4277: remove the original overly permissive
-- generation-attempts RLS policy. Service-role edge functions bypass RLS and
-- retain full DML; browser clients may only read their own attempt history.
-- This migration matches the verified production hotfix.
BEGIN;

ALTER TABLE public.song_generation_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage generation attempts"
  ON public.song_generation_attempts;
DROP POLICY IF EXISTS "Users can view their own generation attempts"
  ON public.song_generation_attempts;

REVOKE ALL PRIVILEGES ON TABLE public.song_generation_attempts
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.song_generation_attempts TO authenticated;

CREATE POLICY "Users can view their own generation attempts"
  ON public.song_generation_attempts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMIT;
