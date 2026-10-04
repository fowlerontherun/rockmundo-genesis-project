BEGIN;

DO $contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gig_equipment_loadouts'
      AND column_name='luthiery_snapshot'
  ) THEN
    RAISE EXCEPTION 'Phase 6 gig Luthiery snapshot column missing';
  END IF;

  IF has_table_privilege('authenticated','public.gig_equipment_loadouts','INSERT')
     OR has_table_privilege('authenticated','public.gig_equipment_loadouts','UPDATE')
     OR has_table_privilege('authenticated','public.gig_equipment_loadouts','DELETE') THEN
    RAISE EXCEPTION 'Gig Luthiery loadouts must be RPC-only for clients';
  END IF;

  IF NOT has_function_privilege('authenticated','public.get_owned_luthiery_equipment_details(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_equipped_stage_luthiery_instruments(uuid[])','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.save_gig_member_luthiery_loadout(uuid,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.remove_gig_member_luthiery_loadout(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated Phase 6 Luthiery RPC permissions missing';
  END IF;

  IF has_function_privilege('anon','public.get_owned_luthiery_equipment_details(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.save_gig_member_luthiery_loadout(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous Phase 6 Luthiery RPC execution must be denied';
  END IF;
END
$contract$;

SET LOCAL session_replication_role=replica;

INSERT INTO auth.users(id,email,role)
VALUES
  ('f6000000-0000-4000-8000-000000000001','phase6-player@example.test','authenticated'),
  ('f6000000-0000-4000-8000-000000000002','phase6-other@example.test','authenticated');

INSERT INTO public.profiles(id,user_id,username,display_name,is_active)
VALUES
  ('f6100000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001','phase6_player','Phase 6 Player',true),
  ('f6100000-0000-4000-8000-000000000002','f6000000-0000-4000-8000-000000000002','phase6_other','Phase 6 Other',true);

INSERT INTO public.bands(id,name,leader_id)
VALUES('f6200000-0000-4000-8000-000000000001','Phase 6 Band','f6000000-0000-4000-8000-000000000001');

INSERT INTO public.band_members(
  id,band_id,user_id,profile_id,role,instrument_role,instrument_roles,member_status,is_touring_member
)
VALUES(
  'f6300000-0000-4000-8000-000000000001',
  'f6200000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  'f6100000-0000-4000-8000-000000000001',
  'member','Lead Guitar',ARRAY['Lead Guitar'],'active',false
);

INSERT INTO public.venues(id,name,capacity,venue_type,prestige_level)
VALUES('f6400000-0000-4000-8000-000000000001','Phase 6 Venue',500,'club',1);

INSERT INTO public.gigs(id,venue_id,band_id,scheduled_date,status)
VALUES
  ('f6500000-0000-4000-8000-000000000001','f6400000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001',now()+interval '1 day','scheduled'),
  ('f6500000-0000-4000-8000-000000000002','f6400000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001',now()+interval '1 day 2 hours','scheduled');

INSERT INTO public.equipment_items(
  id,name,category,subcategory,price,rarity,stat_boosts,is_crafted,crafted_by_profile_id,custom_name
)
VALUES(
  'f6600000-0000-4000-8000-000000000001',
  'Phase 6 Razor','guitar','custom_luthiery',0,'epic',
  '{"luthiery_tone":92,"luthiery_sustain":88,"luthiery_stability":84,"luthiery_output":90,"luthiery_stage_presence":95,"luthiery_quality":91}'::jsonb,
  true,'f6100000-0000-4000-8000-000000000001','Phase 6 Razor'
);

INSERT INTO public.player_equipment(
  id,user_id,profile_id,equipment_id,is_equipped,equipped,condition
)
VALUES(
  'f6700000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  'f6100000-0000-4000-8000-000000000001',
  'f6600000-0000-4000-8000-000000000001',
  true,true,80
);

INSERT INTO public.luthiery_crafts(
  id,profile_id,user_id,idempotency_key,request_hash,equipment_id,player_equipment_id,
  instrument_name,instrument_kind,shape_id,colour,finish_id,decal,parts,material_snapshot,
  skill_snapshot,quality_roll,final_quality,final_stats,result
)
SELECT
  'f6800000-0000-4000-8000-000000000001',
  'f6100000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  'phase6-fixture','phase6-hash',
  'f6600000-0000-4000-8000-000000000001',
  'f6700000-0000-4000-8000-000000000001',
  'Phase 6 Razor','electric_guitar','razor','#e11d48','finish-artwork',
  '{"id":"lightning","x":50,"y":50,"scale":100,"rotation":0,"colour":"#f5f5f5"}'::jsonb,
  '{}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'source','body','materialId',material.id::text,'materialName',material.name,'qualityTier',material.quality_tier
  )),
  '{"basic":20,"professional":20,"mastery":8}'::jsonb,
  1,91,
  '{"tone":92,"sustain":88,"stability":84,"output":90,"stagePresence":95}'::jsonb,
  jsonb_build_object(
    'buildSpec',
    jsonb_build_object(
      'instrumentName','Phase 6 Razor',
      'instrumentKind','electric_guitar',
      'shapeId','razor',
      'shapeName','Razor',
      'colour','#e11d48',
      'finishId','finish-artwork',
      'finishName','Custom Artwork',
      'materialSnapshot',jsonb_build_array(jsonb_build_object(
        'source','body','materialId',material.id::text,'materialName',material.name,'qualityTier',material.quality_tier
      ))
    )
  )
FROM public.crafting_materials material
ORDER BY material.quality_tier DESC,material.base_cost DESC
LIMIT 1;

SET LOCAL session_replication_role=origin;

SELECT set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $owner_detail$
DECLARE
  v_detail record;
  v_stage record;
BEGIN
  SELECT * INTO v_detail
  FROM public.get_owned_luthiery_equipment_details('f6100000-0000-4000-8000-000000000001')
  WHERE player_equipment_id='f6700000-0000-4000-8000-000000000001';

  IF v_detail.instrument_name <> 'Phase 6 Razor'
     OR v_detail.shape_id <> 'razor'
     OR v_detail.colour <> '#e11d48'
     OR v_detail.final_quality <> 91
     OR v_detail.condition <> 80
     OR v_detail.is_equipped IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Crafted instrument owner detail projection is incorrect';
  END IF;

  SELECT * INTO v_stage
  FROM public.get_equipped_stage_luthiery_instruments(
    ARRAY['f6100000-0000-4000-8000-000000000001'::uuid]
  );
  IF v_stage.shape_id <> 'razor'
     OR v_stage.colour <> '#e11d48'
     OR v_stage.final_quality <> 91 THEN
    RAISE EXCEPTION 'Equipped stage instrument projection is incorrect';
  END IF;
END
$owner_detail$;

DO $assignment$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.save_gig_member_luthiery_loadout(
    'f6500000-0000-4000-8000-000000000001',
    'f6700000-0000-4000-8000-000000000001'
  );

  IF v_result->>'equipmentRole' <> 'guitar'
     OR (v_result->>'qualityScore')::integer <> 91
     OR (v_result->>'conditionScore')::integer <> 80
     OR (v_result->>'reliabilityScore')::integer <> 85
     OR v_result->'luthierySnapshot'->>'shapeId' <> 'razor'
     OR v_result->'luthierySnapshot'->>'colour' <> '#e11d48' THEN
    RAISE EXCEPTION 'Authoritative gig Luthiery snapshot incorrect: %',v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.gig_equipment_loadouts
    WHERE gig_id='f6500000-0000-4000-8000-000000000001'
      AND assigned_profile_id='f6100000-0000-4000-8000-000000000001'
      AND player_equipment_id='f6700000-0000-4000-8000-000000000001'
      AND source_type='member_owned'
      AND quality_score=91
      AND condition_score=80
      AND reliability_score=85
      AND luthiery_snapshot->>'shapeId'='razor'
  ) THEN
    RAISE EXCEPTION 'Gig Luthiery loadout row was not persisted correctly';
  END IF;

  BEGIN
    UPDATE public.player_equipment
    SET condition=100
    WHERE id='f6700000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Assigned crafted instrument remained mutable';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'gig_luthiery_assigned_instrument_locked' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.save_gig_member_luthiery_loadout(
      'f6500000-0000-4000-8000-000000000002',
      'f6700000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'Overlapping gig assignment should have conflicted';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'gig_luthiery_instrument_schedule_conflict' THEN RAISE; END IF;
  END;

  IF public.remove_gig_member_luthiery_loadout('f6500000-0000-4000-8000-000000000001') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Crafted instrument gig assignment could not be removed';
  END IF;

  UPDATE public.player_equipment
  SET condition=100
  WHERE id='f6700000-0000-4000-8000-000000000001';

  v_result := public.save_gig_member_luthiery_loadout(
    'f6500000-0000-4000-8000-000000000002',
    'f6700000-0000-4000-8000-000000000001'
  );
  IF (v_result->>'conditionScore')::integer <> 100
     OR (v_result->>'reliabilityScore')::integer <> 96 THEN
    RAISE EXCEPTION 'Reassignment did not refresh current condition snapshot: %',v_result;
  END IF;
END
$assignment$;

RESET ROLE;

UPDATE public.gigs
SET status='live'
WHERE id='f6500000-0000-4000-8000-000000000002';

SELECT set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;

DO $live_lock$
BEGIN
  BEGIN
    PERFORM public.remove_gig_member_luthiery_loadout('f6500000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Live gig allowed crafted instrument assignment removal';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'gig_luthiery_gig_locked' THEN RAISE; END IF;
  END;
END
$live_lock$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','f6000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;

DO $character_safety$
BEGIN
  BEGIN
    PERFORM 1
    FROM public.get_owned_luthiery_equipment_details('f6100000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Another account read private crafted inventory provenance';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'luthiery_equipment_active_profile_required' THEN RAISE; END IF;
  END;
END
$character_safety$;

RESET ROLE;
ROLLBACK;
