-- #4240: full paid-video lifecycle verification, all changes rolled back.
BEGIN;
CREATE TEMP TABLE video_test_player AS
SELECT p.id profile_id,p.user_id,p.cash,
 (SELECT s.id FROM public.songs s WHERE s.user_id=p.user_id
   AND (s.profile_id IS NULL OR s.profile_id=p.id)
   ORDER BY s.id LIMIT 1) song_id
FROM public.profiles p
WHERE p.is_vip=true AND p.cash>=300000 AND p.is_active=true AND p.died_at IS NULL
 AND p.deleted_at IS NULL
 AND p.id=(SELECT q.id FROM public.profiles q WHERE q.user_id=p.user_id
   AND q.is_active=true AND q.died_at IS NULL
   ORDER BY q.updated_at DESC NULLS LAST,q.created_at DESC NULLS LAST,q.id LIMIT 1)
 AND EXISTS (SELECT 1 FROM public.songs s WHERE s.user_id=p.user_id
   AND (s.profile_id IS NULL OR s.profile_id=p.id))
ORDER BY p.id LIMIT 1;

GRANT SELECT ON video_test_player TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM video_test_player),true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE video_first AS
SELECT public.reserve_music_video_generation(
 (SELECT song_id FROM video_test_player),'Webhook rollback test - failure',
 '{"visual_theme":"cinematic"}'::jsonb,
 'cc440000-0000-4000-8000-000000004001'::uuid
) AS result;
CREATE TEMP TABLE video_reserve_replay AS
SELECT public.reserve_music_video_generation(
 (SELECT song_id FROM video_test_player),'Webhook rollback test - failure',
 '{"visual_theme":"cinematic"}'::jsonb,
 'cc440000-0000-4000-8000-000000004001'::uuid
) AS result;
CREATE TEMP TABLE video_success_reservation AS
SELECT public.reserve_music_video_generation(
 (SELECT song_id FROM video_test_player),'Webhook rollback test - success',
 '{"visual_theme":"concert"}'::jsonb,
 'cc440000-0000-4000-8000-000000004002'::uuid
) AS result;
CREATE TEMP TABLE video_preflight_reservation AS
SELECT public.reserve_music_video_generation(
 (SELECT song_id FROM video_test_player),'Webhook rollback test - preflight',
 '{"visual_theme":"neon"}'::jsonb,
 'cc440000-0000-4000-8000-000000004003'::uuid
) AS result;
CREATE TEMP TABLE video_stale_reservation AS
SELECT public.reserve_music_video_generation(
 (SELECT song_id FROM video_test_player),'Webhook rollback test - stale',
 '{"visual_theme":"retro"}'::jsonb,
 'cc440000-0000-4000-8000-000000004004'::uuid
) AS result;
RESET ROLE;

-- Internal service-role operations are SQL SECURITY DEFINER but inaccessible
-- to the browser; run them as the test harness' trusted SQL owner.
CREATE TEMP TABLE video_claim AS
SELECT public.claim_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_first),
 'cc440000-0000-4000-8000-000000004001'::uuid
) result;
CREATE TEMP TABLE video_register AS
SELECT public.register_music_video_prediction(
 (SELECT (result->>'video_id')::uuid FROM video_first),
 'cc440000-0000-4000-8000-000000004001'::uuid,
 'verified-provider-prediction-1'
) result;

DO $negative$
DECLARE v_vid uuid:=(SELECT (result->>'video_id')::uuid FROM video_first);
BEGIN
 BEGIN
   PERFORM public.settle_music_video_generation(
     v_vid,'forged-provider-prediction','failed',NULL,'forged failure');
   RAISE EXCEPTION 'Unexpectedly accepted a mismatched prediction';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'VIDEO_PREDICTION_MISMATCH' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.claim_music_video_generation(v_vid,
     'cc440000-0000-4000-8000-000000004001'::uuid);
   RAISE EXCEPTION 'Duplicate preflight was accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'VIDEO_RESERVATION_NOT_AVAILABLE' THEN RAISE; END IF;
 END;
END;
$negative$;

CREATE TEMP TABLE video_failure AS
SELECT public.settle_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_first),
 'verified-provider-prediction-1','failed',NULL,'Replicate failed'
) result;
CREATE TEMP TABLE video_failure_replay AS
SELECT public.settle_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_first),
 'verified-provider-prediction-1','failed',NULL,'replicate repeated'
) result;
CREATE TEMP TABLE video_failure_after_success AS
SELECT public.settle_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_first),
 'verified-provider-prediction-1','succeeded','https://replicate.delivery/fake.mp4',NULL
) result;

SELECT public.claim_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_success_reservation),
 'cc440000-0000-4000-8000-000000004002'::uuid);
SELECT public.register_music_video_prediction(
 (SELECT (result->>'video_id')::uuid FROM video_success_reservation),
 'cc440000-0000-4000-8000-000000004002'::uuid,'verified-provider-prediction-2'
);
CREATE TEMP TABLE video_success AS
SELECT public.settle_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_success_reservation),
 'verified-provider-prediction-2','succeeded',
 'https://replicate.delivery/fake.mp4',NULL
) result;
CREATE TEMP TABLE video_success_replay AS
SELECT public.settle_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_success_reservation),
 'verified-provider-prediction-2','failed',NULL,'fake delayed failure'
) result;

SELECT public.claim_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_preflight_reservation),
 'cc440000-0000-4000-8000-000000004003'::uuid
);
CREATE TEMP TABLE video_preflight_failure AS
SELECT public.settle_music_video_generation(
 (SELECT (result->>'video_id')::uuid FROM video_preflight_reservation),
 NULL,'failed',NULL,'first frame failed'
) result;

-- Advance only fixture created_at. Expiration must refund unregistered
-- reservations with the same atomic once-only transition.
UPDATE public.music_video_generation_attempts
 SET created_at=now()-interval '2 hours'
 WHERE id='cc440000-0000-4000-8000-000000004004'::uuid;
CREATE TEMP TABLE video_expired AS
SELECT public.expire_stale_music_video_preparations() result;

SELECT
 (SELECT count(*)=1 FROM video_test_player) fixture_selected,
 (SELECT result->>'video_id'=r.result->>'video_id' FROM video_first f
   CROSS JOIN video_reserve_replay r) reservation_reuses_video,
 (SELECT result->>'already_reserved'='true' FROM video_reserve_replay) reservation_idempotent,
 (SELECT result->>'claimed'='true' FROM video_claim) generation_claimed_once,
 (SELECT result->>'registered'='true' FROM video_register) provider_registered,
 (SELECT result->>'settled'='true' AND result->>'refunded'='true'
    FROM video_failure) failure_refunded,
 (SELECT result->>'settled'='false' FROM video_failure_replay) duplicate_failure_ignored,
 (SELECT result->>'settled'='false' FROM video_failure_after_success) prior_failure_cannot_succeed,
 (SELECT result->>'settled'='true' AND result->>'refunded'='false'
    FROM video_success) success_settled,
 (SELECT result->>'settled'='false' FROM video_success_replay) late_failure_cannot_refund_success,
 (SELECT result->>'settled'='true' FROM video_preflight_failure) preflight_refunded,
 (SELECT (result->>'refunded')::int>=1 FROM video_expired) stale_refunded,
 (SELECT p.cash=t.cash-75000 FROM public.profiles p JOIN video_test_player t ON t.profile_id=p.id) only_success_charged,
 (SELECT count(*)=3 FROM public.music_video_generation_attempts
    WHERE state='failed' AND refunded_at IS NOT NULL
    AND id IN ('cc440000-0000-4000-8000-000000004001'::uuid,
      'cc440000-0000-4000-8000-000000004003'::uuid,
      'cc440000-0000-4000-8000-000000004004'::uuid)) three_unique_refunds,
 (SELECT count(*)=1 FROM public.music_video_generation_attempts
    WHERE state='succeeded' AND refunded_at IS NULL
      AND id='cc440000-0000-4000-8000-000000004002'::uuid) success_not_refunded,
 (SELECT count(*)=4 FROM public.music_video_generation_attempts
    WHERE id IN ('cc440000-0000-4000-8000-000000004001'::uuid,
      'cc440000-0000-4000-8000-000000004002'::uuid,
      'cc440000-0000-4000-8000-000000004003'::uuid,
      'cc440000-0000-4000-8000-000000004004'::uuid)) all_attempts_unique,
 NOT has_function_privilege('authenticated',
    'public.settle_music_video_generation(uuid,text,text,text,text)','EXECUTE') browser_refund_denied,
 NOT has_function_privilege('anon',
    'public.reserve_music_video_generation(uuid,text,jsonb,uuid)','EXECUTE') anon_reservation_denied,
 has_function_privilege('authenticated',
    'public.reserve_music_video_generation(uuid,text,jsonb,uuid)','EXECUTE') player_reservation_allowed,
 (SELECT count(*)=3 FROM public.activity_feed WHERE metadata->>'attempt_id' IN (
    'cc440000-0000-4000-8000-000000004001',
    'cc440000-0000-4000-8000-000000004002',
    'cc440000-0000-4000-8000-000000004003'
 )) lifecycle_notifications_once;
ROLLBACK;
