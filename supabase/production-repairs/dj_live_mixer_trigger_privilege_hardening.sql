-- Production security-advisor follow-up. Supabase may directly grant
-- EXECUTE to anon/authenticated even after revocation from PUBLIC.
-- Neither trigger routine is a public Data API action.
REVOKE ALL ON FUNCTION public.require_dj_live_mix_for_settlement()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dj_mix_event_immutable()
 FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION public.require_dj_live_mix_for_settlement() IS
 'Internal BEFORE INSERT DJ settlement guard; no anon/authenticated EXECUTE; rejects payouts without authenticated timed mixer evidence.';
