-- Read-only release preflight permissions and expiry check with rollback fixtures.
-- Executed only on a disposable PostgreSQL service.
BEGIN;
INSERT INTO public.player_owned_skins(profile_id,item_id,item_type,is_equipped)
VALUES (
 '10000000-0000-4000-8000-000000000002',
 '50000000-0000-4000-8000-000000000001',
 'clothing',false
);
-- Owning the hat must not report launch-ready until the curated asset
-- is genuinely published. Restore the disposable fixture afterwards.
UPDATE public.avatar_clothing_items
 SET curated_asset_status='asset_ready'
 WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat';
SET LOCAL ROLE service_role;
DO $published_check$
BEGIN
 IF (public.admin_halloween_2026_launch_preflight()->>'database_ready')::boolean
  OR (public.admin_halloween_2026_launch_preflight()->'checks'->>'pumpkin_hat_published')::boolean
 THEN RAISE EXCEPTION 'Unpublished Pumpkin Hat was incorrectly release-ready'; END IF;
END;
$published_check$;
RESET ROLE;
UPDATE public.avatar_clothing_items
 SET curated_asset_status='published'
 WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat';
SET LOCAL ROLE service_role;
DO $preflightcheck$
DECLARE
 r jsonb;
BEGIN
 SELECT public.admin_halloween_2026_launch_preflight() INTO r;
 IF coalesce((r->>'database_ready')::boolean,false) IS NOT TRUE
  OR (r->>'characters')::integer<>2
  OR (r->>'characters_gifted')::integer<>2
  OR (r->>'event_enabled')::boolean IS NOT FALSE
  OR (r->>'rewards_armed')::boolean IS NOT FALSE
 THEN RAISE EXCEPTION 'Halloween server readiness unexpectedly failed: %',r; END IF;
END;
$preflightcheck$;
SET LOCAL ROLE authenticated;
DO $preflightcheck$
DECLARE
 denied boolean := false;
BEGIN
 BEGIN
   PERFORM public.admin_halloween_2026_launch_preflight();
 EXCEPTION WHEN insufficient_privilege THEN
   denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Non-admin could read private Halloween preflight'; END IF;
END;
$preflightcheck$;
-- An authenticated caller must additionally have the DB-backed admin role.
SET LOCAL test.admin_uid = '20000000-0000-4000-8000-000000000001';
DO $preflightcheck$
DECLARE
 r jsonb;
BEGIN
 r := public.admin_halloween_2026_launch_preflight();
 IF (r->>'database_ready')::boolean IS NOT TRUE THEN
   RAISE EXCEPTION 'A real authenticated admin was incorrectly blocked';
 END IF;
END;
$preflightcheck$;
ROLLBACK;
