-- Add district_id to rehearsal_rooms
ALTER TABLE public.rehearsal_rooms
ADD COLUMN district_id UUID REFERENCES public.city_districts(id);