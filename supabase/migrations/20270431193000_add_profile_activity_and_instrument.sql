BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_activity text,
  ADD COLUMN IF NOT EXISTS primary_instrument text,
  ADD COLUMN IF NOT EXISTS travel_mode text,
  ADD COLUMN IF NOT EXISTS current_city_id uuid REFERENCES public.cities(id);

NOTIFY pgrst, 'reload schema';

COMMIT;
