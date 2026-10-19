-- #4272: rollback-only DB assertions; requires a release owned by an
-- active member and the party questions seed. No fixtures remain afterward.
BEGIN;

CREATE TEMP TABLE rp_test_ctx ON COMMIT DROP AS
SELECT r.id AS release_id, bm.user_id AS owner_id,
       coalesce(r.hype_score,0) AS prior_hype
FROM public.releases r
JOIN public.band_members bm ON bm.band_id=r.band_id
JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
WHERE r.release_status IN ('manufacturing','released')
  AND bm.member_status='active'
  AND NOT coalesce(bm.is_touring_member,false)
  AND p.is_active IS TRUE AND p.died_at IS NULL
  AND p.id=(
    SELECT p2.id FROM public.profiles p2
    WHERE p2.user_id=bm.user_id AND p2.is_active=true AND p2.died_at IS NULL
    ORDER BY p2.updated_at DESC NULLS LAST,p2.created_at DESC NULLS LAST,p2.id
    LIMIT 1
  )
ORDER BY r.id LIMIT 1;

CREATE TEMP TABLE rp_test_answers ON COMMIT DROP AS
SELECT jsonb_agg(
  jsonb_build_object('question_id',id,'chosen_option','a','timed_out',false)
) AS answers
FROM (SELECT id FROM public.release_party_questions ORDER BY id LIMIT 5) q;

-- Choose the active character's auth identity without exposing any IDs.
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM rp_test_ctx),true);

-- Legacy releases with release_party_done=true and no result must fail closed.
-- This script unlocks only one release inside a transaction that is rolled back.
UPDATE public.releases SET release_party_done=false
WHERE id=(SELECT release_id FROM rp_test_ctx);

CREATE TEMP TABLE rp_test_first ON COMMIT DROP AS
SELECT public.settle_release_party_atomic(
  (SELECT release_id FROM rp_test_ctx),
  (SELECT answers FROM rp_test_answers)
) AS result;

CREATE TEMP TABLE rp_test_repeat ON COMMIT DROP AS
SELECT public.settle_release_party_atomic(
  (SELECT release_id FROM rp_test_ctx),
  '[{"question_id":"00000000-0000-0000-0000-000000000000","chosen_option":"x"}]'::jsonb
) AS result;

SELECT
  (SELECT count(*)=1 FROM rp_test_ctx) AS fixture_found,
  (SELECT jsonb_array_length(answers)=5 FROM rp_test_answers) AS five_questions,
  (SELECT result->>'success'='true' AND result->>'already_completed'='false'
     FROM rp_test_first) AS first_applied,
  (SELECT result->>'already_completed'='true' FROM rp_test_repeat) AS replay_ignored,
  (SELECT f.result->>'result_id'=r.result->>'result_id'
     FROM rp_test_first f CROSS JOIN rp_test_repeat r) AS same_settlement,
  (SELECT count(*)=1 FROM public.release_party_results WHERE release_id=(SELECT release_id FROM rp_test_ctx)) AS exactly_one_result,
  (SELECT r.release_party_done AND r.hype_score=least(1000,
       c.prior_hype+(f.result->>'hype_awarded')::integer)
   FROM public.releases r JOIN rp_test_ctx c ON c.release_id=r.id
     CROSS JOIN rp_test_first f) AS hype_committed_once,
  NOT has_function_privilege('anon','public.settle_release_party_atomic(uuid,jsonb)','EXECUTE') AS anonymous_denied,
  has_function_privilege('authenticated','public.settle_release_party_atomic(uuid,jsonb)','EXECUTE') AS authenticated_rpc_allowed,
  NOT has_table_privilege('authenticated','public.release_party_results','INSERT') AS direct_insert_denied;

ROLLBACK;
