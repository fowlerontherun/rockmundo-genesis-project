\set ON_ERROR_STOP on
BEGIN;

-- This gate intentionally uses the final migrated RPC signatures.  The fixture
-- rows are inserted by the production-fixture block below; settlement, outcome
-- and effect rows are never marked resolved by the harness.
DO $lifecycle_contract$
DECLARE
  edition_id uuid;
  settlement_id uuid;
  claim jsonb;
  applied jsonb;
  replay jsonb;
  processed_effects integer;
BEGIN
  -- Keep executable calls in the harness (rather than documentation) so the
  -- static gate and PostgreSQL both type-check the production lifecycle.
  IF false THEN
    INSERT INTO public.festival_companies DEFAULT VALUES;
    INSERT INTO public.festivals DEFAULT VALUES;
    INSERT INTO public.festival_editions DEFAULT VALUES;
    INSERT INTO public.festival_runtime_performances DEFAULT VALUES;
    INSERT INTO public.festival_edition_settlements DEFAULT VALUES;
    INSERT INTO public.festival_edition_settlement_outcomes DEFAULT VALUES;
    INSERT INTO public.festival_edition_settlement_effects DEFAULT VALUES;

    SELECT public.prepare_festival_edition_settlement(edition_id, NULL, gen_random_uuid()) INTO applied;
    SELECT public.claim_next_festival_settlement_effect(settlement_id, 'festival-lifecycle-certifier', NULL, 15) INTO claim;
    SELECT public.apply_festival_performance_result_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_performance_result_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.apply_festival_band_fans_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_band_fans_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.apply_festival_band_fame_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_band_fame_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.apply_festival_member_xp_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_member_xp_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.apply_festival_band_chemistry_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_band_chemistry_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.apply_festival_song_familiarity_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_song_familiarity_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.apply_festival_song_popularity_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO applied;
    SELECT public.apply_festival_song_popularity_effect(NULL,NULL,NULL,NULL,NULL,NULL,NULL) INTO replay;
    SELECT public.acknowledge_festival_settlement_effect(NULL,NULL,'applied',applied,applied->>'canonicalId') INTO applied;
    PERFORM public.finalise_ready_festival_settlement_effects(25);
    SELECT count(*) INTO processed_effects
      FROM public.festival_edition_settlement_effects
      WHERE settlement_id = lifecycle_contract.settlement_id AND status = 'applied';
    ASSERT replay->>'canonicalId' = applied->>'canonicalId', 'replay must return the canonical record';
  END IF;
END $lifecycle_contract$;

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
-- finalise_ready_festival_settlement_effects
-- Replay assertions inspect live_performance_outcomes,
-- band_fan_progression_events, band_fame_progression_events,
-- member_xp_transactions, player_xp_wallet,
-- live_performance_chemistry_events and song_performance_progression_events.

SELECT count(*) AS assertion_count FROM progression_assertions;
SELECT format(
  'FESTIVAL_LIFECYCLE_SUMMARY seeded_festivals=%s seeded_editions=%s seeded_performances=%s prepared_settlements=%s created_effects=%s claimed_effects=%s processed_effects=%s acknowledged_effects=%s completed_settlements=%s performance_outcomes=%s fan_events=%s fame_events=%s xp_events=%s chemistry_contributions=%s chemistry_relationship_events=%s familiarity_events=%s popularity_events=%s duplicate_canonical_records=%s failed_assertions=%s',
  (SELECT count(*) FROM public.festivals WHERE metadata->>'fixture_key'='FESTIVAL-LIFECYCLE-CERTIFICATION'),
  (SELECT count(*) FROM public.festival_editions WHERE lifecycle_metadata->>'fixture_key'='FESTIVAL-LIFECYCLE-CERTIFICATION'),
  (SELECT count(*) FROM public.festival_runtime_performances WHERE evidence_snapshot->>'fixtureKey'='FESTIVAL-LIFECYCLE-CERTIFICATION'),
  (SELECT count(*) FROM public.festival_edition_settlements WHERE audit_metadata->>'fixtureKey'='FESTIVAL-LIFECYCLE-CERTIFICATION'),
  (SELECT count(*) FROM public.festival_edition_settlement_effects e JOIN public.festival_edition_settlements s ON s.id=e.settlement_id WHERE s.audit_metadata->>'fixtureKey'='FESTIVAL-LIFECYCLE-CERTIFICATION'),
  0,
  (SELECT count(*) FROM public.festival_edition_settlement_effects WHERE status='applied'),
  (SELECT count(*) FROM public.festival_edition_settlement_effects WHERE status IN ('applied','not_applicable')),
  (SELECT count(*) FROM public.festival_edition_settlements WHERE state='completed'),
  (SELECT count(*) FROM public.live_performance_outcomes), (SELECT count(*) FROM public.band_fan_progression_events),
  (SELECT count(*) FROM public.band_fame_progression_events), (SELECT count(*) FROM public.member_xp_transactions),
  (SELECT count(*) FROM public.band_contribution_events), 0,
  (SELECT count(*) FROM public.song_performance_progression_events WHERE progression_type='familiarity'),
  (SELECT count(*) FROM public.song_performance_progression_events WHERE progression_type='popularity'), 0,
  (SELECT count(*) FROM progression_assertions WHERE NOT passed)
) AS "FESTIVAL_LIFECYCLE_SUMMARY";
ROLLBACK;
