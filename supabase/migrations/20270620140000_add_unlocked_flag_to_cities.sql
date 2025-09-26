-- Ensure the cities table exposes an unlocked flag for onboarding logic
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS unlocked boolean DEFAULT true;

-- Make sure existing rows are marked as unlocked when the column is introduced
UPDATE public.cities
SET unlocked = true
WHERE unlocked IS NULL;
