-- #4250: verifies authenticated promotion starts still work after removing
-- direct INSERT/UPDATE privileges. All fixtures roll back; no real charges.
BEGIN;

CREATE TEMP TABLE sp_start_fixture AS
SELECT p.id AS profile_id, p.user_id, bm.band_id,
       'test_self_promo_' || replace(gen_random_uuid()::text,'-','') AS activity_type
FROM public.band_members bm
JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
WHERE bm.member_status='active'
  AND NOT coalesce(bm.is_touring_member,false)
  AND p.is_active IS TRUE AND p.died_at IS NULL
  AND p.id=(
    SELECT id FROM public.profiles p2
    WHERE p2.user_id=p.user_id AND p2.is_active=true AND p2.died_at IS NULL
    ORDER BY p2.updated_at DESC NULLS LAST,
      p2.created_at DESC NULLS LAST,p2.id LIMIT 1
  )
ORDER BY p.id LIMIT 1;

INSERT INTO public.self_promotion_catalog(
  activity_type,name,description,duration_minutes,cooldown_days,
  base_cost,base_fame_min,base_fame_max,base_fan_min,base_fan_max,
  min_fame_required,is_active
)
SELECT activity_type,'Security test promo','Rollback only',10,1,
  0,1,2,1,2,0,true FROM sp_start_fixture;

SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM sp_start_fixture),true);
SELECT set_config('app.sp_profile',(SELECT profile_id::text FROM sp_start_fixture),true);
SELECT set_config('app.sp_band',(SELECT band_id::text FROM sp_start_fixture),true);
SELECT set_config('app.sp_type',(SELECT activity_type FROM sp_start_fixture),true);

SET LOCAL ROLE authenticated;

CREATE TEMP TABLE sp_start_result AS
SELECT public.start_self_promotion(
  current_setting('app.sp_profile')::uuid,
  current_setting('app.sp_band')::uuid,
  current_setting('app.sp_type')::text,
  'general'
) AS result;

RESET ROLE;

SELECT
 (SELECT count(*)=1 FROM sp_start_fixture) AS fixture_present,
 (SELECT result ? 'promotion_id' FROM sp_start_result) AS authenticated_start_succeeded,
 (SELECT count(*)=1 FROM public.self_promotion_activities a
    WHERE a.id=(SELECT (result->>'promotion_id')::uuid FROM sp_start_result)
      AND a.status='in_progress'
      AND a.cost_paid=0) AS one_trusted_activity,
 (SELECT count(*)=1 FROM public.player_scheduled_activities s
    WHERE s.id=(SELECT (result->>'scheduled_activity_id')::uuid FROM sp_start_result)
      AND s.profile_id=(SELECT profile_id FROM sp_start_fixture)) AS schedule_linked_to_character,
 (SELECT count(*)=1 FROM public.self_promotion_cooldowns c
    WHERE c.activity_type=(SELECT activity_type FROM sp_start_fixture)
      AND c.band_id=(SELECT band_id FROM sp_start_fixture)) AS cooldown_created,
 NOT has_table_privilege('authenticated','public.self_promotion_activities','INSERT') AS unauthorized_insert_denied;

ROLLBACK;
