-- The legacy lineup VIEW currently bypasses festival_contracts RLS.
-- Preserve the public read-only projection through the existing
-- public_festival_lineup_read(uuid) RPC (which only exposes active lineups),
-- while making direct view queries honor the caller's underlying RLS.
BEGIN;
ALTER VIEW public.public_festival_lineup SET (security_invoker=true);
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
 ON TABLE public.public_festival_lineup FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.public_festival_lineup TO anon,authenticated;
COMMIT;