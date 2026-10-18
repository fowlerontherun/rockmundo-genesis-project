-- Ensure current_city_id exists on profiles and refresh schema cache
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_city_id uuid REFERENCES public.cities(id);

-- Refresh PostgREST schema cache so the new column is immediately available
NOTIFY pgrst, 'reload schema';
