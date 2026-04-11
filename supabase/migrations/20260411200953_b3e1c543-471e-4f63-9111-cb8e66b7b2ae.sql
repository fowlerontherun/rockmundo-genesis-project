
-- Step 1: Drop the old FK constraint first
ALTER TABLE public.bands DROP CONSTRAINT IF EXISTS bands_leader_id_fkey;

-- Step 2: Update all existing leader_id values from auth user IDs to profile IDs
UPDATE public.bands b
SET leader_id = p.id
FROM public.profiles p
WHERE p.user_id = b.leader_id::uuid
  AND b.leader_id IS NOT NULL;

-- Step 3: Add correct FK referencing profiles
ALTER TABLE public.bands
  ADD CONSTRAINT bands_leader_id_fkey
  FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
