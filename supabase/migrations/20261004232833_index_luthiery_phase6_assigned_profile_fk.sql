CREATE INDEX IF NOT EXISTS idx_gig_equipment_loadouts_assigned_profile_fk
ON public.gig_equipment_loadouts(assigned_profile_id,gig_id)
WHERE assigned_profile_id IS NOT NULL;
