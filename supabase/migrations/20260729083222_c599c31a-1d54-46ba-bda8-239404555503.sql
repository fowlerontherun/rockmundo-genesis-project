ALTER TABLE public.tours DROP CONSTRAINT IF EXISTS tours_travel_mode_check;
ALTER TABLE public.tours ADD CONSTRAINT tours_travel_mode_check
  CHECK (travel_mode = ANY (ARRAY['manual'::text,'auto'::text,'bus'::text,'train'::text,'plane'::text,'ship'::text,'tour_bus'::text]));