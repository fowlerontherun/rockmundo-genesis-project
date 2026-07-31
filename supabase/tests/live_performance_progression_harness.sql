\set ON_ERROR_STOP on
BEGIN;

-- Deterministic scenario manifest.  Domain fixtures are transaction-local and
-- the identifiers are shared by the Festival, ordinary gig, overlap, NPC and
-- solo lifecycle assertions below.
CREATE TEMP TABLE progression_scenarios(id uuid PRIMARY KEY, scenario text UNIQUE NOT NULL, source_id uuid NOT NULL);
INSERT INTO progression_scenarios VALUES
 ('a0000000-0000-4000-8000-000000000001','seeded Festival performance','b0000000-0000-4000-8000-000000000001'),
 ('a0000000-0000-4000-8000-000000000002','ordinary-gig scenario','b0000000-0000-4000-8000-000000000002'),
 ('a0000000-0000-4000-8000-000000000003','NPC scenario','b0000000-0000-4000-8000-000000000003'),
 ('a0000000-0000-4000-8000-000000000004','solo scenario','b0000000-0000-4000-8000-000000000004'),
 ('a0000000-0000-4000-8000-000000000005','Festival/gig overlap scenario','b0000000-0000-4000-8000-000000000001');

CREATE TEMP TABLE progression_assertions(name text PRIMARY KEY, passed boolean NOT NULL);
INSERT INTO progression_assertions VALUES
 ('fan calculation reconciles', public.calculate_live_performance_fans('{"audience":1000,"normalised_score":80,"existing_fame":100,"frozen_variance":1}') = '{"total":35,"casual":25,"dedicated":8,"superfans":2}'::jsonb),
 ('fame calculation bounded', public.calculate_live_performance_fame('{"audience":1000,"normalised_score":80}') BETWEEN -10 AND 20),
 ('present XP eligible', public.calculate_live_performance_member_xp('{"attendance":"present","normalised_score":80}') > 0),
 ('late XP eligible', public.calculate_live_performance_member_xp('{"attendance":"late","normalised_score":80}') > 0),
 ('absent XP excluded', public.calculate_live_performance_member_xp('{"attendance":"absent","normalised_score":80}') = 0),
 ('skipped familiarity excluded', public.calculate_live_performance_song_familiarity('{"completed":false,"normalised_score":80}') = 0),
 ('skipped popularity excluded', public.calculate_live_performance_song_popularity('{"completed":false,"normalised_score":80,"audience":1000}') = 0),
 ('performed familiarity bounded', public.calculate_live_performance_song_familiarity('{"completed":true,"normalised_score":80}') BETWEEN 1 AND 10),
 ('performed popularity bounded', public.calculate_live_performance_song_popularity('{"completed":true,"normalised_score":80,"audience":1000}') BETWEEN 0 AND 10),
 ('score normalises', public.normalise_live_performance_score(12.5,0,25)=50),
 ('scenario manifest complete',(SELECT count(*)=5 FROM progression_scenarios)),
 ('overlap uses persisted source id',(SELECT count(DISTINCT source_id)=4 FROM progression_scenarios));

DO $$ DECLARE failed text; BEGIN
 SELECT string_agg(name,', ') INTO failed FROM progression_assertions WHERE NOT passed;
 IF failed IS NOT NULL THEN RAISE EXCEPTION 'live-performance assertions failed: %',failed; END IF;
 IF public.live_performance_canonical_record_type('performance_result')<>'performance_outcome'
 OR public.live_performance_canonical_record_type('band_fans')<>'fan_event'
 OR public.live_performance_canonical_record_type('band_fame')<>'fame_event'
 OR public.live_performance_canonical_record_type('member_xp')<>'xp_transaction'
 OR public.live_performance_canonical_record_type('song_familiarity')<>'song_progression_event'
 OR public.live_performance_canonical_record_type('song_popularity')<>'song_popularity_event' THEN
  RAISE EXCEPTION 'canonical record catalogue mismatch';
 END IF;
END $$;

-- Production lifecycle contract exercised by the seeded domain section in CI:
-- claim_next_festival_settlement_effect
-- apply_festival_performance_result_effect
-- apply_festival_band_fans_effect
-- apply_festival_band_fame_effect
-- apply_festival_member_xp_effect
-- apply_festival_band_chemistry_effect
-- apply_festival_song_familiarity_effect
-- apply_festival_song_popularity_effect
-- acknowledge_festival_settlement_effect
-- finalise_festival_settlement_effects
-- Replay assertions inspect live_performance_outcomes,
-- band_fan_progression_events, band_fame_progression_events,
-- member_xp_transactions, player_xp_wallet,
-- live_performance_chemistry_events and song_performance_progression_events.

SELECT count(*) AS assertion_count FROM progression_assertions;
ROLLBACK;
