-- Drop the old unique constraint on both profile_id and job_id
ALTER TABLE public.player_employment 
  DROP CONSTRAINT IF EXISTS player_employment_profile_id_job_id_key;

-- Add new unique constraint on profile_id only (one active job per profile)
-- But only for employed status
CREATE UNIQUE INDEX player_employment_active_profile_idx 
  ON public.player_employment (profile_id) 
  WHERE status = 'employed';