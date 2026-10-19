-- #4250: real database end-to-end verification, zero persistent changes.
BEGIN;

CREATE TEMP TABLE sp_fixture AS
SELECT gen_random_uuid()::uuid AS due_id,
       gen_random_uuid()::uuid AS future_id,
       gen_random_uuid()::uuid AS scheduled_id,
       a.band_id, a.user_id, a.activity_type
FROM public.self_promotion_activities a
JOIN public.self_promotion_catalog c ON c.activity_type=a.activity_type
WHERE a.band_id IS NOT NULL AND a.user_id IS NOT NULL
ORDER BY a.created_at DESC NULLS LAST LIMIT 1;

CREATE TEMP TABLE sp_band_before AS
SELECT b.id,coalesce(b.fame,0) AS fame,
       coalesce(b.total_fans,0) AS fans,
       coalesce(b.morale,50) AS morale,
       coalesce(b.fan_sentiment_score,0) AS sentiment
FROM public.bands b JOIN sp_fixture f ON f.band_id=b.id;

INSERT INTO public.self_promotion_activities(
  id,user_id,band_id,activity_type,scheduled_start,scheduled_end,status
)
SELECT due_id,user_id,band_id,activity_type,now()-interval '2 hours',
  now()-interval '1 hour','in_progress' FROM sp_fixture
UNION ALL
SELECT future_id,user_id,band_id,activity_type,now(),
  now()+interval '1 hour','in_progress' FROM sp_fixture
UNION ALL
SELECT scheduled_id,user_id,band_id,activity_type,now()-interval '2 hours',
  now()-interval '1 hour','scheduled' FROM sp_fixture;

CREATE TEMP TABLE sp_first AS
SELECT public.settle_self_promotion_atomic((SELECT due_id FROM sp_fixture)) AS result;
CREATE TEMP TABLE sp_repeat AS
SELECT public.settle_self_promotion_atomic((SELECT due_id FROM sp_fixture)) AS result;
CREATE TEMP TABLE sp_future AS
SELECT public.settle_self_promotion_atomic((SELECT future_id FROM sp_fixture)) AS result;
CREATE TEMP TABLE sp_scheduled AS
SELECT public.settle_self_promotion_atomic((SELECT scheduled_id FROM sp_fixture)) AS result;

SELECT
  (SELECT count(*)=1 FROM sp_fixture) AS fixture_present,
  (SELECT result->>'settled'='true' FROM sp_first) AS settled_exactly_once,
  (SELECT result->>'reason'='already_completed' FROM sp_repeat) AS replay_denied,
  (SELECT result->>'reason'='not_due' FROM sp_future) AS future_denied,
  (SELECT result->>'reason'='not_in_progress' FROM sp_scheduled) AS scheduled_denied,
  (SELECT count(*)=1 FROM public.band_fame_events e
     WHERE e.event_type='self_promotion'
       AND e.event_data->>'activity_id'=(SELECT due_id::text FROM sp_fixture)) AS one_fame_event,
  (SELECT a.status='completed'
       AND a.fame_gained=(f.result->>'fame_gained')::integer
       AND a.fans_gained=(f.result->>'fans_gained')::integer
     FROM public.self_promotion_activities a
     CROSS JOIN sp_first f WHERE a.id=(SELECT due_id FROM sp_fixture)) AS activity_matches,
  (SELECT b.fame = a.fame+(f.result->>'fame_gained')::integer
       AND b.total_fans = a.fans+(f.result->>'fans_gained')::integer
     FROM public.bands b JOIN sp_band_before a ON a.id=b.id CROSS JOIN sp_first f) AS band_rewards_match,
  (SELECT count(*)=1 FROM public.self_promotion_cooldowns cd
     WHERE cd.band_id=(SELECT band_id FROM sp_fixture)
       AND cd.activity_type=(SELECT activity_type FROM sp_fixture)) AS cooldown_upserted,
  NOT has_function_privilege('anon','public.settle_self_promotion_atomic(uuid)','EXECUTE') AS anon_denied,
  NOT has_function_privilege('authenticated','public.settle_self_promotion_atomic(uuid)','EXECUTE') AS player_denied,
  has_function_privilege('service_role','public.settle_self_promotion_atomic(uuid)','EXECUTE') AS service_allowed,
  NOT has_function_privilege('authenticated','public.process_due_self_promotions(integer)','EXECUTE') AS batch_player_denied,
  (SELECT command='SELECT public.process_due_self_promotions();'
   FROM cron.job WHERE jobname='complete-self-promotions-every-10-min') AS cron_internal,
  (SELECT schedule='*/10 * * *' FROM cron.job
   WHERE jobname='complete-self-promotions-every-10-min') AS cadence_unchanged,
  NOT has_table_privilege('authenticated','public.self_promotion_activities','INSERT') AS forged_client_insert_denied,
  NOT has_table_privilege('authenticated','public.self_promotion_activities','UPDATE') AS client_reward_mutations_denied,
  NOT has_function_privilege('anon','public.start_self_promotion(uuid,uuid,text,text)','EXECUTE') AS anon_start_denied,
  has_function_privilege('authenticated','public.start_self_promotion(uuid,uuid,text,text)','EXECUTE') AS player_start_rpc_allowed,
  (SELECT prosecdef FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND proname='start_self_promotion') AS start_rpc_privileged;

ROLLBACK;
