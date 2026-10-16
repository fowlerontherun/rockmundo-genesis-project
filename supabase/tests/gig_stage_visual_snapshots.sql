-- Run only on a disposable, migrated local Supabase database.
-- Snapshot fixtures and any existing gig/profile edits are rolled back.
BEGIN;
DO $$
DECLARE
 v_gig uuid;
 v_profile uuid;
 v_error boolean := false;
 v_before jsonb;
BEGIN
 IF has_table_privilege('anon','public.gig_stage_visual_snapshots','SELECT')
   OR has_table_privilege('authenticated','public.gig_stage_visual_snapshots','SELECT')
   OR has_table_privilege('authenticated','public.gig_stage_visual_snapshots','INSERT')
   OR has_table_privilege('service_role','public.gig_stage_visual_snapshots','UPDATE')
 THEN RAISE EXCEPTION 'Stage cosmetics snapshot permissions too broad'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid='public.gig_stage_visual_snapshots'::regclass) THEN
    RAISE EXCEPTION 'Stage snapshot RLS disabled';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_capture_gig_stage_visual_snapshots'
    AND tgrelid='public.gigs'::regclass AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'Authoritative gig start capture trigger missing'; END IF;

 SELECT id INTO v_gig FROM public.gigs ORDER BY created_at LIMIT 1;
 SELECT id INTO v_profile FROM public.profiles WHERE user_id IS NOT NULL ORDER BY id LIMIT 1;
 IF v_gig IS NOT NULL AND v_profile IS NOT NULL THEN
   INSERT INTO public.gig_stage_visual_snapshots (gig_id,profile_id,visual_snapshot)
   VALUES(v_gig,v_profile,
     '{"version":1,"appearance":{"body":{"frame":"masculine"}},"clothing":[]}'::jsonb)
   ON CONFLICT (gig_id,profile_id) DO NOTHING;
   SELECT visual_snapshot INTO v_before FROM public.gig_stage_visual_snapshots
     WHERE gig_id=v_gig AND profile_id=v_profile;
   INSERT INTO public.gig_stage_visual_snapshots (gig_id,profile_id,visual_snapshot)
   VALUES(v_gig,v_profile,
     '{"version":1,"appearance":{"body":{"frame":"feminine"}},"clothing":[]}'::jsonb)
   ON CONFLICT (gig_id,profile_id) DO NOTHING;
   IF (SELECT visual_snapshot FROM public.gig_stage_visual_snapshots
      WHERE gig_id=v_gig AND profile_id=v_profile) IS DISTINCT FROM v_before
   THEN RAISE EXCEPTION 'Duplicate gig start overwrote old outfit'; END IF;

   BEGIN
      UPDATE public.gig_stage_visual_snapshots
      SET visual_snapshot='{"version":1,"clothing":[]}'::jsonb
      WHERE gig_id=v_gig AND profile_id=v_profile;
   EXCEPTION WHEN SQLSTATE 'P0001' THEN
      v_error:=true;
   END;
   IF NOT v_error THEN RAISE EXCEPTION 'Historical outfit accepted an UPDATE'; END IF;
 END IF;
END;
$$;
ROLLBACK;
