REVOKE ALL PRIVILEGES ON TABLE public.character_coma_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.character_coma_events TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.character_coma_events TO service_role;