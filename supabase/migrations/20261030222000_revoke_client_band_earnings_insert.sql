-- #4730 FINAL EARNINGS CUTOVER.
-- All three known browser earnings writers (admin gifting, cover licenses,
-- radio income) have been replaced with authenticated, validated SECURITY
-- DEFINER database RPCs. Other live SQL earnings writers were audited and
-- are SECURITY DEFINER worker functions, not invoker functions.
--
-- The old member INSERT policy allowed an authenticated band member to mint
-- arbitrary cash by adding a positive earnings row for their own band.
-- Revoke direct INSERT entirely; only server-side gameplay authority can
-- create accounting entries. This does not remove band members' SELECT rights
-- to their own earnings history.
DROP POLICY IF EXISTS "Authenticated users can insert earnings"
  ON public.band_earnings;

REVOKE INSERT ON TABLE public.band_earnings FROM authenticated;

COMMENT ON TABLE public.band_earnings IS
  'Authoritative game-currency receipt ledger. Browser roles may read only their band receipts; all mutations must use vetted SECURITY DEFINER game RPCs or trusted workers. Never restore client INSERT without a new threat model.';
