-- Real PostgreSQL smoke audit: checks private counts without revealing IDs.
-- Everything is rolled back, including the gig start and late performer.
BEGIN;
UPDATE public.gigs
  SET status='in_progress',started_at='2026-10-25T12:00:00Z'
  WHERE id='30000000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
DO $smoke$
DECLARE
 e jsonb;
BEGIN
 SELECT public.admin_halloween_2026_launch_preflight()->'live_gig_evidence' INTO e;
 IF (e->>'gigs_started_since_install')::integer<>1
   OR (e->>'expected_performer_snapshots')::integer<>2
   OR (e->>'captured_performer_snapshots')::integer<>2
   OR (e->>'missing_performer_snapshots')::integer<>0
   OR (e->>'first_reward_claims')::integer<>0
   OR (e->>'requires_human_visual_inspection')::boolean IS NOT TRUE
 THEN RAISE EXCEPTION 'Incorrect start-time snapshot coverage: %',e; END IF;
END;
$smoke$;
RESET ROLE;
-- A performer selected after the gig began has NO trustworthy gig-start
-- snapshot; the admin audit must flag the missing evidence, not invent it.
INSERT INTO public.profiles(id,user_id,experience) VALUES
 ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003',0);
INSERT INTO public.gig_performers(id,gig_id,profile_id,lineup_status) VALUES
 ('40000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003','selected');
SET LOCAL ROLE service_role;
DO $smoke$
DECLARE
 e jsonb;
BEGIN
 SELECT public.admin_halloween_2026_launch_preflight()->'live_gig_evidence' INTO e;
 IF (e->>'expected_performer_snapshots')::integer<>3
   OR (e->>'captured_performer_snapshots')::integer<>2
   OR (e->>'missing_performer_snapshots')::integer<>1
 THEN RAISE EXCEPTION 'A late-added performer was not flagged for manual replay QA: %',e; END IF;
END;
$smoke$;
ROLLBACK;
