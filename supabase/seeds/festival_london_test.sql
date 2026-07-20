-- Development/test-only fixture for the Festival Owner Dashboard.
-- Run manually with: npm run seed:festival:london (requires app.allow_test_fixtures=true)
DO $$
BEGIN
  IF current_setting('app.allow_test_fixtures', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Test fixture execution not enabled. Set app.allow_test_fixtures=true before running the London fixture.';
  END IF;
END $$;

DO $$
DECLARE
  v_brand uuid := '11111111-1111-4111-8111-111111111111';
  v_edition uuid := '11111111-1111-4111-8111-111111111112';
  v_legacy uuid := '11111111-1111-4111-8111-111111111113';
  v_venue uuid := '11111111-1111-4111-8111-111111111114';
  v_city uuid;
  v_start timestamptz := (current_date + 60 + time '10:00') AT TIME ZONE 'Europe/London';
  v_end timestamptz := (current_date + 62 + time '23:00') AT TIME ZONE 'Europe/London';
  v_stage uuid;
  v_slot uuid;
  v_names text[] := ARRAY['The Thames Lines','Electric Borough','Camden Static','Southbank Riot','Neon Underground','The Night Buses','Soho Feedback','Brixton Echoes','Hackney Signals','Greenwich Static','Islington Relay','Peckham Frequencies','Chelsea Riot','Wembley Afterglow','Shoreditch Arcade','Deptford Frequencies','Kensington Voltage','Stratford Signals','Vauxhall Feedback','Canary Static','Clapham Riot'];
  v_idx int := 0;
  v_day int;
  v_hour int;
  v_stage_name text;
BEGIN
  SELECT id INTO v_city FROM public.cities WHERE lower(name)='london' ORDER BY created_at NULLS LAST LIMIT 1;
  IF v_city IS NULL THEN RAISE EXCEPTION 'London city fixture prerequisite is missing'; END IF;

  INSERT INTO public.venues(id,name,location,capacity,venue_type,base_payment,prestige_level,requirements)
  VALUES (v_venue,'London Test Festival Grounds','London',10000,'outdoor festival site',0,3,jsonb_build_object('fixture','london-dashboard','fixture_key','RM-LONDON-TEST-FESTIVAL'))
  ON CONFLICT (id) DO UPDATE SET name=excluded.name, location=excluded.location, capacity=excluded.capacity, venue_type=excluded.venue_type, requirements=excluded.requirements;
  UPDATE public.venues SET city_id=v_city WHERE id=v_venue AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='venues' AND column_name='city_id');

  INSERT INTO public.festivals(id,name,city_id,venue_id,scale,status,start_date,end_date,expected_attendance,ticket_price_low,ticket_price_high,genre,description,metadata)
  VALUES (v_brand,'RockMundo London Test Festival',v_city,v_venue,'large','upcoming',v_start::date,v_end::date,7500,55,240,'mixed','Development and QA fixture for validating the complete RockMundo festival workflow.',jsonb_build_object('fixture','london-dashboard','fixture_key','RM-LONDON-TEST-FESTIVAL','is_test_fixture',true,'slug','rockmundo-london-test-festival'))
  ON CONFLICT (id) DO UPDATE SET name=excluded.name, city_id=excluded.city_id, venue_id=excluded.venue_id, start_date=excluded.start_date, end_date=excluded.end_date, expected_attendance=excluded.expected_attendance, metadata=excluded.metadata;

  INSERT INTO public.game_events(id,title,description,event_type,start_date,end_date,max_participants,requirements,is_active)
  VALUES (v_legacy,'RockMundo London Test Festival compatibility event','Read-only compatibility mapping for canonical London dashboard fixture.','festival',v_start,v_end,10000,jsonb_build_object('fixture','london-dashboard','canonical_festival_edition_id',v_edition,'legacy_festival_read_only',true),true)
  ON CONFLICT (id) DO UPDATE SET title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,requirements=excluded.requirements;

  INSERT INTO public.festival_editions(id,festival_id,edition_number,edition_year,title,slug,description,city_id,venue_id,start_at,end_at,timezone,time_zone,doors_open_at,curfew_at,expected_attendance,capacity,minimum_ticket_price_cents,maximum_ticket_price_cents,currency_code,budget_cents,status,lifecycle_metadata,public_metadata,legacy_metadata)
  VALUES (v_edition,v_brand,1,extract(year from v_start)::int,'RockMundo London Test Festival','rockmundo-london-test-festival','Development and QA fixture for validating the complete RockMundo festival workflow.',v_city,v_venue,v_start,v_end,'Europe/London','Europe/London',v_start - interval '2 hours',v_end,7500,10000,5500,24000,'GBP',25000000,'announced',jsonb_build_object('fixture','london-dashboard','is_test_fixture',true,'ticket_summary',jsonb_build_object('capacity',10000,'tickets_sold',3250,'tiers',jsonb_build_array(jsonb_build_object('name','Weekend General Admission','price_cents',12000,'inventory',6000,'sold',2100),jsonb_build_object('name','Day Ticket','price_cents',5500,'inventory',3000,'sold',900),jsonb_build_object('name','VIP Weekend','price_cents',24000,'inventory',1000,'sold',250)))),jsonb_build_object('fixture','london-dashboard','is_test_fixture',true,'alcohol',false,'food_vendors',false,'camping',false,'road_closure',false),jsonb_build_object('compatibility_game_event_id',v_legacy))
  ON CONFLICT (id) DO UPDATE SET start_at=excluded.start_at,end_at=excluded.end_at,edition_year=excluded.edition_year,city_id=excluded.city_id,venue_id=excluded.venue_id,budget_cents=excluded.budget_cents,status=excluded.status,lifecycle_metadata=excluded.lifecycle_metadata,public_metadata=excluded.public_metadata,legacy_metadata=excluded.legacy_metadata;

  INSERT INTO public.festival_legacy_mappings(edition_id,legacy_source,legacy_id,legacy_festival_id,metadata)
  VALUES (v_edition,'game_event',v_legacy,v_brand,jsonb_build_object('fixture','london-dashboard','read_only',true))
  ON CONFLICT (legacy_source, legacy_id) DO UPDATE SET edition_id=excluded.edition_id, legacy_festival_id=excluded.legacy_festival_id, metadata=excluded.metadata;

  DELETE FROM public.festival_stage_slots WHERE edition_id=v_edition AND idempotency_key LIKE 'RM-LONDON-TEST-FESTIVAL:%';
  DELETE FROM public.festival_system_acts WHERE edition_id=v_edition AND internal_seed='RM-LONDON-TEST-FESTIVAL';
  DELETE FROM public.festival_stages WHERE edition_id=v_edition AND idempotency_key LIKE 'RM-LONDON-TEST-FESTIVAL:%';

  FOREACH v_stage_name IN ARRAY ARRAY['Main Stage','River Stage','New Music Stage'] LOOP
    v_stage := CASE v_stage_name WHEN 'Main Stage' THEN '11111111-1111-4111-8111-111111111120'::uuid WHEN 'River Stage' THEN '11111111-1111-4111-8111-111111111121'::uuid ELSE '11111111-1111-4111-8111-111111111122'::uuid END;
    INSERT INTO public.festival_stages(id,festival_id,edition_id,stage_name,stage_number,capacity,genre_focus,stage_type,public_name,technical_metadata,public_metadata,idempotency_key)
    VALUES (v_stage,v_brand,v_edition,v_stage_name,CASE v_stage_name WHEN 'Main Stage' THEN 1 WHEN 'River Stage' THEN 2 ELSE 3 END,CASE v_stage_name WHEN 'Main Stage' THEN 7000 WHEN 'River Stage' THEN 3000 ELSE 1500 END,'mixed','outdoor',v_stage_name,jsonb_build_object('fixture','london-dashboard'),jsonb_build_object('fixture','london-dashboard'),'RM-LONDON-TEST-FESTIVAL:'||v_stage_name);
    FOR v_day IN 0..2 LOOP
      FOREACH v_hour IN ARRAY CASE v_stage_name WHEN 'Main Stage' THEN ARRAY[15,17,19,21] WHEN 'River Stage' THEN ARRAY[14,16,18,20] ELSE ARRAY[13,15,17,19] END LOOP
        v_slot := ('11111111-1111-4111-8111-' || lpad((111111111200 + v_idx)::text,12,'0'))::uuid;
        INSERT INTO public.festival_stage_slots(id,stage_id,festival_id,edition_id,day_number,slot_number,slot_type,start_time,end_time,changeover_minutes,status,public_status,slot_template,reservation_metadata,idempotency_key)
        VALUES (v_slot,v_stage,v_brand,v_edition,v_day+1,(v_day*4)+(CASE v_hour WHEN 13 THEN 1 WHEN 14 THEN 1 WHEN 15 THEN 2 WHEN 16 THEN 2 WHEN 17 THEN 3 WHEN 18 THEN 3 ELSE 4 END),CASE WHEN v_hour>=21 THEN 'headliner' WHEN v_hour>=19 THEN 'support' ELSE 'opener' END,(v_start::date + v_day + make_interval(hours=>v_hour)) AT TIME ZONE 'Europe/London',(v_start::date + v_day + make_interval(hours=>v_hour+1)) AT TIME ZONE 'Europe/London',30,CASE WHEN v_idx < 21 THEN 'confirmed' ELSE 'open' END,CASE WHEN v_idx < 21 THEN 'announced' ELSE 'draft' END,'london-dashboard',jsonb_build_object('fixture','london-dashboard'),'RM-LONDON-TEST-FESTIVAL:slot:'||v_idx);
          IF v_idx < 21 THEN
            INSERT INTO public.festival_system_acts(id,edition_id,slot_id,deterministic_key,display_name,act_type,genre,quality_tier,public_metadata,internal_seed,status)
            VALUES (('11111111-1111-4111-8111-' || lpad((111111111300 + v_idx)::text,12,'0'))::uuid,v_edition,v_slot,'RM-LONDON-ACT-'||v_idx,v_names[v_idx+1],'fixture_system_act','rock',CASE WHEN v_idx < 3 THEN 'headline' WHEN v_idx < 10 THEN 'strong' ELSE 'local' END,jsonb_build_object('fixture','london-dashboard','published',v_idx < 15),'RM-LONDON-TEST-FESTIVAL','assigned')
            ON CONFLICT (edition_id, deterministic_key) DO UPDATE SET slot_id=excluded.slot_id, display_name=excluded.display_name, public_metadata=excluded.public_metadata, status=excluded.status;
            UPDATE public.festival_stage_slots SET reservation_metadata=reservation_metadata || jsonb_build_object('system_act_id',('11111111-1111-4111-8111-' || lpad((111111111300 + v_idx)::text,12,'0'))::uuid,'contract_status',CASE WHEN v_idx < 14 THEN 'signed' WHEN v_idx < 18 THEN 'accepted' ELSE 'published' END), status='confirmed' WHERE id=v_slot;
          END IF;
        v_idx := v_idx + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  DELETE FROM public.festival_staff WHERE edition_id=v_edition AND idempotency_key LIKE 'RM-LONDON-TEST-FESTIVAL:%';
  INSERT INTO public.festival_staff(festival_id,edition_id,role,name,skill_level,weekly_wage_cents,status,assignment_scope,metadata,idempotency_key)
  SELECT v_brand,v_edition,role,name,skill,weekly,'active',scope,jsonb_build_object('fixture','london-dashboard'),'RM-LONDON-TEST-FESTIVAL:staff:'||replace(lower(name),' ','-') FROM (VALUES ('promoter','Festival Manager',85,150000,'{}'::jsonb),('booker','Production Manager',82,130000,'{}'::jsonb),('safety_officer','Security Lead',80,110000,'{}'::jsonb),('medic','Medical Lead',78,100000,'{}'::jsonb),('stage_manager','Main Stage Manager',75,90000,jsonb_build_object('stage_id','11111111-1111-4111-8111-111111111120')),('stage_manager','River Stage Manager',72,85000,jsonb_build_object('stage_id','11111111-1111-4111-8111-111111111121')),('stage_manager','New Music Stage Manager',70,80000,jsonb_build_object('stage_id','11111111-1111-4111-8111-111111111122')),('sound_engineer','Main Stage Sound Engineer',76,95000,jsonb_build_object('stage_id','11111111-1111-4111-8111-111111111120')),('sound_engineer','River Stage Sound Engineer',74,90000,jsonb_build_object('stage_id','11111111-1111-4111-8111-111111111121')),('sound_engineer','New Music Stage Sound Engineer',72,85000,jsonb_build_object('stage_id','11111111-1111-4111-8111-111111111122'))) v(role,name,skill,weekly,scope);

  DELETE FROM public.festival_permits WHERE edition_id=v_edition AND idempotency_key LIKE 'RM-LONDON-TEST-FESTIVAL:%';
  INSERT INTO public.festival_permits(festival_id,edition_id,city_id,permit_type,status,permit_fee_cents,approved_at,expires_on,requirement_code,reason,idempotency_key)
  SELECT v_brand,v_edition,v_city,kind,'approved',fee,now(),(v_end + interval '30 days')::date,code,'London dashboard fixture approved permit','RM-LONDON-TEST-FESTIVAL:permit:'||code FROM (VALUES ('event','public_event',50000),('noise','noise',25000),('event','temporary_structures',90000),('safety','fire_safety',40000),('noise','amplified_music',30000)) v(kind,code,fee);

  DELETE FROM public.festival_insurance_policies WHERE edition_id=v_edition AND idempotency_key='RM-LONDON-TEST-FESTIVAL:insurance';
  INSERT INTO public.festival_insurance_policies(festival_id,edition_id,coverage_type,premium_cents,payout_ceiling_cents,weather_rider,active,effective_from,effective_to,policy_status,idempotency_key)
  VALUES (v_brand,v_edition,'standard',250000,100000000,true,true,(v_start - interval '7 days')::date,(v_end + interval '7 days')::date,'pending_payment','RM-LONDON-TEST-FESTIVAL:insurance');

  DELETE FROM public.festival_expense_ledger WHERE edition_id=v_edition AND idempotency_key LIKE 'RM-LONDON-TEST-FESTIVAL:%';
  INSERT INTO public.festival_expense_ledger(festival_id,edition_number,edition_id,category,direction,amount_cents,currency_code,status,description,source_type,source_id,due_at,idempotency_key)
  SELECT v_brand,1,v_edition,category,'expense',amount,'GBP','committed',description,'london_dashboard_fixture',v_edition,v_start,'RM-LONDON-TEST-FESTIVAL:ledger:'||category FROM (VALUES ('artist_guarantee',6000000,'Artist commitments'),('stage_rental',2000000,'Venue'),('security',1200000,'Security'),('staff_wages',900000,'Staffing'),('insurance',250000,'Insurance'),('equipment_rental',650000,'Production')) v(category,amount,description);

  RAISE NOTICE 'RockMundo London Test Festival seeded: brand %, edition %, public /festivals/%, owner /festivals/%/manage/editions/%', v_brand, v_edition, v_brand, v_brand, v_edition;
END $$;

CREATE OR REPLACE FUNCTION public.assign_london_test_festival_owner(p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_brand uuid := '11111111-1111-4111-8111-111111111111'; v_edition uuid := '11111111-1111-4111-8111-111111111112';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.festivals WHERE id=v_brand) OR NOT EXISTS (SELECT 1 FROM public.festival_editions WHERE id=v_edition AND festival_id=v_brand) THEN RAISE EXCEPTION 'London fixture brand or edition not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile_id) THEN RAISE EXCEPTION 'Profile % not found', p_profile_id; END IF;
  UPDATE public.festivals SET owner_profile_id=p_profile_id, metadata=metadata || jsonb_build_object('fixture_owner_assigned_at',now()) WHERE id=v_brand;
  RETURN jsonb_build_object('festival_id',v_brand,'edition_id',v_edition,'public_url','/festivals/'||v_brand,'owner_url','/festivals/'||v_brand||'/manage/editions/'||v_edition);
END $$;

REVOKE ALL ON FUNCTION public.assign_london_test_festival_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_london_test_festival_owner(uuid) TO service_role;
