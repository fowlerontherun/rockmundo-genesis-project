-- Add a city reference to venues so location-specific filtering is possible
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);

CREATE INDEX IF NOT EXISTS venues_city_id_idx ON public.venues(city_id);
