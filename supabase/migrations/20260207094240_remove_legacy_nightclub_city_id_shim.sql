-- The compatibility trigger is needed only while the immediately preceding
-- historical nightclub seed is replayed. Remove it afterwards so normal game
-- writes are unaffected.

DROP TRIGGER IF EXISTS remap_legacy_nightclub_city_id ON public.city_night_clubs;
DROP FUNCTION IF EXISTS public.remap_legacy_nightclub_city_id();
