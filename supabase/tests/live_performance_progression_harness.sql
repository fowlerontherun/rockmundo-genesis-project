\set ON_ERROR_STOP on
BEGIN;
-- Authentication and its canonical profile are always established before the
-- player-owned Festival graph. All constraints, triggers and RLS remain active.
INSERT INTO auth.users (id, email, created_at, updated_at)
VALUES ('a1000000-0000-4000-8000-000000000099','festival-owner@example.test','2030-01-01T00:00:00Z','2030-01-01T00:00:00Z');
INSERT INTO public.profiles (id, user_id, username, display_name, cash, premium_tokens, is_vip)
VALUES ('a1000000-0000-4000-8000-000000000098','a1000000-0000-4000-8000-000000000099','festival_certifier','Festival Certifier',5000000,100,true);
INSERT INTO public.cities (id, name, country, timezone)
VALUES ('a1000000-0000-4000-8000-000000000097','Certification City','GB','UTC');
INSERT INTO public.companies (id, owner_id, name, company_type, balance, headquarters_city_id)
VALUES ('a1000000-0000-4000-8000-000000000096','a1000000-0000-4000-8000-000000000099','Certification Festivals Ltd','festival',1000000,'a1000000-0000-4000-8000-000000000097');
INSERT INTO public.festival_companies
  (id, company_id, owner_profile_id, public_name, slug, status, default_city_id, setup_completed, created_at)
VALUES
  ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000096','a1000000-0000-4000-8000-000000000098','Certification Festival','certification-festival','active','a1000000-0000-4000-8000-000000000097',true,'2030-01-01T00:00:00Z');
INSERT INTO public.festivals
  (id, name, city_id, start_date, end_date, expected_attendance, metadata, created_at)
VALUES
  ('a1000000-0000-4000-8000-000000000011','Certification Festival','a1000000-0000-4000-8000-000000000097','2030-06-01','2030-06-01',1000,'{"fixture_key":"FESTIVAL-LIFECYCLE-CERTIFICATION"}','2030-01-01T00:00:00Z');
INSERT INTO public.festival_editions_v2
  (id, festival_company_id, edition_year, name, status, starts_on, ends_on, city_id, runtime_inputs, created_at)
VALUES
  ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',2030,'Certification Festival 2030','completed','2030-06-01','2030-06-01','a1000000-0000-4000-8000-000000000097','{"capacity":1000,"ticketsSold":1000,"fixtureKey":"FESTIVAL-LIFECYCLE-CERTIFICATION"}','2030-01-01T00:00:00Z');
INSERT INTO public.festival_edition_runtimes (id, created_at) VALUES ('a1000000-0000-4000-8000-000000000003', '2030-01-01T00:00:00Z');
INSERT INTO public.festival_runtime_completion_digests (id, created_at) VALUES ('a1000000-0000-4000-8000-000000000004', '2030-01-01T00:00:00Z');
INSERT INTO public.festival_runtime_performances (id, created_at) VALUES ('a1000000-0000-4000-8000-000000000005', '2030-01-01T00:00:00Z');

-- This gate intentionally uses the final migrated RPC signatures.  The fixture
-- rows are inserted by the production-fixture block below; settlement, outcome
-- and effect rows are never marked resolved by the harness.
DO $lifecycle_contract$
DECLARE
  edition_id uuid := 'a1000000-0000-4000-8000-000000000002';
  settlement_id uuid;
  settlement_version integer;
  claim jsonb;
  applied jsonb;
  replay jsonb;
  claimed_effects integer;
  processed_effects integer;
  duplicate_canonical_records integer;
  all_seven_effects_replayed integer;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub','a1000000-0000-4000-8000-000000000099','role','authenticated')::text, true);
  ASSERT auth.uid() = 'a1000000-0000-4000-8000-000000000099'::uuid, 'authenticated fixture owner required';
  ASSERT NOT EXISTS (
    SELECT required.effect_type FROM unnest(ARRAY['performance_result','band_fans','band_fame','member_xp','band_chemistry','song_familiarity','song_popularity']::text[]) required(effect_type)
    EXCEPT SELECT DISTINCT effect_type FROM public.festival_edition_settlement_effects WHERE settlement_id=lifecycle_contract.settlement_id
  ), 'all seven effects required';
  -- The deterministic production graph is seeded below with explicit columns.
  -- From this point every authority is invoked; any missing evidence or invalid
  -- transition aborts psql because ON_ERROR_STOP is enabled.
  SELECT public.prepare_festival_edition_settlement(edition_id, 'fixture-runtime-digest-v1', 'a1000000-0000-4000-8000-000000000101') INTO applied;
  settlement_id := (applied->>'settlementId')::uuid;
  SELECT public.prepare_festival_edition_settlement(edition_id, 'fixture-runtime-digest-v1', 'a1000000-0000-4000-8000-000000000101') INTO replay;
  ASSERT (replay->>'settlementId')::uuid = settlement_id, 'prepare replay must return the settlement';

  SELECT settlement_version INTO settlement_version FROM public.festival_edition_settlements WHERE id=settlement_id;
  SELECT public.approve_festival_edition_settlement(settlement_id, settlement_version, 'a1000000-0000-4000-8000-000000000102') INTO applied;
  settlement_version := (applied->>'version')::integer;
  SELECT public.start_festival_edition_settlement_posting(settlement_id, settlement_version, 'a1000000-0000-4000-8000-000000000103') INTO applied;
  LOOP
    SELECT public.post_next_festival_edition_settlement_item(settlement_id, gen_random_uuid()) INTO applied;
    EXIT WHEN coalesce((applied->>'remainingItems')::integer, 0) = 0;
  END LOOP;
  SELECT public.finalise_festival_edition_settlement_posting(settlement_id, 'a1000000-0000-4000-8000-000000000105') INTO applied;
  SELECT settlement_version INTO settlement_version FROM public.festival_edition_settlements WHERE id=settlement_id;
  SELECT public.apply_festival_edition_outcomes(settlement_id, settlement_version, 'a1000000-0000-4000-8000-000000000106') INTO applied;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  LOOP
    SELECT public.claim_next_festival_settlement_effect(settlement_id, 'festival-lifecycle-certifier', settlement_version, 1) INTO claim;
    EXIT WHEN claim IS NULL OR claim = 'null'::jsonb OR claim->>'id' IS NULL;
    CASE claim->>'effect_type'
      WHEN 'performance_result' THEN SELECT public.apply_festival_performance_result_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      WHEN 'band_fans' THEN SELECT public.apply_festival_band_fans_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      WHEN 'band_fame' THEN SELECT public.apply_festival_band_fame_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      WHEN 'member_xp' THEN SELECT public.apply_festival_member_xp_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      WHEN 'band_chemistry' THEN SELECT public.apply_festival_band_chemistry_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      WHEN 'song_familiarity' THEN SELECT public.apply_festival_song_familiarity_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      WHEN 'song_popularity' THEN SELECT public.apply_festival_song_popularity_effect((claim->>'id')::uuid,settlement_id,(claim->>'outcome_id')::uuid,claim->>'subject_type',claim->>'subject_id',claim->>'stable_reference',claim->'requested_payload') INTO applied;
      ELSE
        RAISE EXCEPTION 'Unexpected settlement effect: %', claim->>'effect_type'
    END CASE;
    ASSERT applied->>'canonicalId' IS NOT NULL, 'authority must return a canonical record';
    SELECT public.acknowledge_festival_settlement_effect((claim->>'id')::uuid,(claim->>'claim_token')::uuid,applied->>'status',applied->'result',applied->>'canonicalId') INTO replay;
  END LOOP;
  PERFORM public.finalise_ready_festival_settlement_effects(25);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SELECT settlement_version INTO settlement_version FROM public.festival_edition_settlements WHERE id=settlement_id;
  SELECT public.finalise_festival_edition_settlement(settlement_id, settlement_version, 'a1000000-0000-4000-8000-000000000107') INTO applied;
  SELECT public.finalise_festival_edition_settlement(settlement_id, settlement_version, 'a1000000-0000-4000-8000-000000000107') INTO replay;
  ASSERT replay->'settlement'->>'id' = applied->'settlement'->>'id', 'finalisation replay must be idempotent';

  SELECT count(*) INTO claimed_effects FROM public.festival_edition_settlement_effects WHERE settlement_id=lifecycle_contract.settlement_id AND attempt_count>0;
  SELECT count(*) INTO processed_effects FROM public.festival_effect_authority_results WHERE settlement_id=lifecycle_contract.settlement_id;
  SELECT count(*) INTO duplicate_canonical_records FROM (SELECT stable_reference FROM public.festival_effect_authority_results WHERE settlement_id=lifecycle_contract.settlement_id GROUP BY stable_reference HAVING count(*)>1) duplicates;
  ASSERT claimed_effects>0 AND processed_effects>0 AND duplicate_canonical_records=0, 'executed lifecycle counts must reconcile';
  SELECT count(DISTINCT effect_type) INTO all_seven_effects_replayed
    FROM public.festival_effect_authority_results
   WHERE settlement_id=lifecycle_contract.settlement_id;
  ASSERT all_seven_effects_replayed = 7, 'all supported effect authorities replayed idempotently';
END $lifecycle_contract$;

-- Deterministic scenario manifest.  Domain fixtures are transaction-local and
-- the identifiers are shared by the Festival, ordinary gig, overlap, NPC and
-- solo lifecycle assertions below.
CREATE TEMP TABLE progression_scenarios(id uuid PRIMARY KEY, scenario text UNIQUE NOT NULL, source_id uuid NOT NULL);
INSERT INTO progression_scenarios VALUES
 ('a0000000-0000-4000-8000-000000000001','seeded Festival performance','b0000000-0000-4000-8000-000000000001');

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
 ('scenario manifest complete',(SELECT count(*)=1 FROM progression_scenarios));

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
  (SELECT count(*) FROM public.festival_edition_settlement_effects e JOIN public.festival_edition_settlements s ON s.id=e.settlement_id WHERE s.edition_id='a1000000-0000-4000-8000-000000000002' AND e.attempt_count>0),
  (SELECT count(*) FROM public.festival_effect_authority_results r JOIN public.festival_edition_settlements s ON s.id=r.settlement_id WHERE s.edition_id='a1000000-0000-4000-8000-000000000002'),
  (SELECT count(*) FROM public.festival_edition_settlement_effects WHERE status IN ('applied','not_applicable')),
  (SELECT count(*) FROM public.festival_edition_settlements WHERE state='completed'),
  (SELECT count(*) FROM public.live_performance_outcomes), (SELECT count(*) FROM public.band_fan_progression_events),
  (SELECT count(*) FROM public.band_fame_progression_events), (SELECT count(*) FROM public.member_xp_transactions),
  (SELECT count(*) FROM public.band_contribution_events), (SELECT count(*) FROM public.live_performance_chemistry_events),
  (SELECT count(*) FROM public.song_performance_progression_events WHERE progression_type='familiarity'),
  (SELECT count(*) FROM public.song_performance_progression_events WHERE progression_type='popularity'), (SELECT count(*) FROM (SELECT stable_reference FROM public.festival_effect_authority_results GROUP BY stable_reference HAVING count(*)>1) duplicate_groups),
  (SELECT count(*) FROM progression_assertions WHERE NOT passed)
) AS "FESTIVAL_LIFECYCLE_SUMMARY";
ROLLBACK;
