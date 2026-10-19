-- Explicitly remove authenticated write grants inherited from project defaults.
-- Only the server-validated mayor RPC may update city battle settings.
REVOKE ALL ON TABLE public.botb_city_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.botb_city_settings TO authenticated;
GRANT ALL ON TABLE public.botb_city_settings TO service_role;
