-- #4232: Remove legacy table privileges that bypass RLS.
REVOKE ALL ON TABLE public.player_modeling_contracts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.player_modeling_contracts TO authenticated;
