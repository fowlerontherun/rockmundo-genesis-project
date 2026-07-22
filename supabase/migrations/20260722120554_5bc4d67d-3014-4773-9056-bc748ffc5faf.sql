DELETE FROM public.festival_stages WHERE festival_id NOT IN (SELECT id FROM public.festivals);
ALTER TABLE public.festival_stages DROP CONSTRAINT festival_stages_festival_id_fkey;
ALTER TABLE public.festival_stages ADD CONSTRAINT festival_stages_festival_id_fkey FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;