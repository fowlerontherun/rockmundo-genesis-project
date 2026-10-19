BEGIN;
DO $t$
DECLARE ou uuid;op uuid;cid uuid;city uuid;owned uuid;du uuid;dp uuid;
 tr uuid;st uuid;app1 uuid;app2 uuid;of1 uuid;of2 uuid;
 k uuid:=gen_random_uuid();ck uuid:=gen_random_uuid();v jsonb;health jsonb;cash0 bigint;
 c1 integer;c2 integer; stt text;ts timestamptz:=clock_timestamp()+interval '2 days';
BEGIN
 IF has_table_privilege('authenticated','public.nightclub_dj_funded_offers','INSERT')
 OR has_table_privilege('authenticated','public.nightclub_dj_escrow_movements','UPDATE')
 OR has_function_privilege('anon','public.fund_nightclub_dj_offer(uuid,uuid,integer,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Escrow ACL failed';END IF;
 SELECT p.user_id,p.id,c.id,c.city_id INTO ou,op,cid,city
 FROM public.profiles p JOIN public.city_night_clubs c ON c.city_id=p.current_city_id
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND c.quality_level BETWEEN 1 AND 5
 AND p.cash >= (CASE c.quality_level WHEN 1 THEN 5000 WHEN 2 THEN 15000
 WHEN 3 THEN 50000 WHEN 4 THEN 150000 WHEN 5 THEN 500000 END)+500
 AND NOT EXISTS(SELECT 1 FROM public.player_owned_nightclubs o WHERE o.club_id=c.id)
 ORDER BY c.quality_level LIMIT 1;
 SELECT p.user_id,p.id INTO du,dp FROM public.profiles p
 WHERE p.is_active AND p.died_at IS NULL AND p.user_id IS NOT NULL AND p.user_id<>ou LIMIT 1;
 IF ou IS NULL OR du IS NULL THEN RAISE NOTICE 'No 2-actor fixture; ACL passed';RETURN;END IF;
 UPDATE public.profiles SET current_city_id=city WHERE id=dp;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 owned:=(public.purchase_nightclub_atomic(op,cid,gen_random_uuid())->>'owned_club_id')::uuid;
 SELECT cash INTO cash0 FROM public.profiles WHERE id=op;
 INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,rights_confirmed,rights_notes,is_active,uploaded_by)
 VALUES('Escrow Test','DJ Fixture','House','catalog/'||gen_random_uuid()||'/fixture.mp3',true,'ROLLBACK only',true,ou)
 RETURNING id INTO tr;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
 VALUES(du,dp,'Escrow Test',jsonb_build_array(jsonb_build_object('source','admin','id',tr::text))) RETURNING id INTO st;
 app1:=public.apply_for_nightclub_dj_slot(dp,owned,st,ts,gen_random_uuid());
 app2:=public.apply_for_nightclub_dj_slot(dp,owned,st,ts+interval '4 hours',gen_random_uuid());
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 PERFORM public.review_nightclub_dj_application(owned,app1,'shortlist',gen_random_uuid());
 PERFORM public.review_nightclub_dj_application(owned,app2,'shortlist',gen_random_uuid());
 v:=public.fund_nightclub_dj_offer(owned,app1,100,k);
 of1:=(v->>'offer_id')::uuid;
 IF of1 IS NULL OR (SELECT cash FROM public.profiles WHERE id=op)<>cash0-100 THEN
  RAISE EXCEPTION 'Owner escrow not debited exactly 100';END IF;
 health:=public.dj_finance_release_health();
 IF (health->'counts'->>'total_offers')::int<>1 OR
    (health->'counts'->>'held_cash')::int<>100 OR
    (health->>'finance_invariants_clear')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Healthy $100 held escrow reported incorrect finance metrics';END IF;
 -- Corrupt only the synthetic movement, then verify observability detects it.
 UPDATE public.nightclub_dj_escrow_movements SET amount=99
  WHERE offer_id=of1 AND kind='fund';
 health:=public.dj_finance_release_health();
 IF (health->'counts'->>'missing_or_mismatched_funding')::int<>1 OR
    (health->>'finance_invariants_clear')::boolean IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'Release-health monitor failed to detect fake $99 escrow receipt';END IF;
 UPDATE public.nightclub_dj_escrow_movements SET amount=100
  WHERE offer_id=of1 AND kind='fund';
 health:=public.dj_finance_release_health();
 IF (health->'counts'->>'missing_or_mismatched_funding')::int<>0 OR
   (health->>'finance_invariants_clear')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Restoring the exact held fee did not clear the financial alert';END IF;
 v:=public.fund_nightclub_dj_offer(owned,app1,100,k);
 IF (v->>'replayed')::boolean IS DISTINCT FROM true
 OR (v->>'offer_id')::uuid IS DISTINCT FROM of1
 OR (SELECT cash FROM public.profiles WHERE id=op)<>cash0-100
 THEN RAISE EXCEPTION 'Funding replay double debited';END IF;
 BEGIN
  PERFORM public.fund_nightclub_dj_offer(owned,app2,100,k);
  RAISE EXCEPTION 'Mismatched funding reuse accepted';
 EXCEPTION WHEN unique_violation THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',du::text,true);
 BEGIN
  PERFORM public.decide_nightclub_dj_offer(of1,'cancel',gen_random_uuid());
  RAISE EXCEPTION 'Guest DJ could cancel owner escrow';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 v:=public.decide_nightclub_dj_offer(of1,'accept',gen_random_uuid());
 IF (v->>'status')<>'accepted' OR (SELECT cash FROM public.profiles WHERE id=op)<>cash0-100
 THEN RAISE EXCEPTION 'Acceptance paid unearned fee';END IF;
 PERFORM set_config('request.jwt.claim.sub',ou::text,true);
 v:=public.decide_nightclub_dj_offer(of1,'cancel',ck);
 IF (v->>'status')<>'cancelled' OR (SELECT cash FROM public.profiles WHERE id=op)<>cash0
 THEN RAISE EXCEPTION 'Cancellation did not refund escrow';END IF;
 v:=public.decide_nightclub_dj_offer(of1,'cancel',ck);
 IF (v->>'replayed')::boolean IS DISTINCT FROM true
 OR (SELECT count(*) FROM public.nightclub_dj_escrow_movements m WHERE m.offer_id=of1 AND m.kind='refund')<>1
 THEN RAISE EXCEPTION 'Cancel was not idempotent';END IF;
 v:=public.fund_nightclub_dj_offer(owned,app2,125,gen_random_uuid());
 of2:=(v->>'offer_id')::uuid;
 IF (SELECT cash FROM public.profiles WHERE id=op)<>cash0-125
 THEN RAISE EXCEPTION 'Second escrow was not held';END IF;
 UPDATE public.nightclub_dj_funded_offers SET expires_at=clock_timestamp()-interval '1 minute'
 WHERE id=of2;
 c1:=private.expire_nightclub_dj_offer_escrows_internal(50);
 c2:=private.expire_nightclub_dj_offer_escrows_internal(50);
 SELECT status INTO stt FROM public.nightclub_dj_funded_offers WHERE id=of2;
 IF c1<>1 OR c2<>0 OR (SELECT cash FROM public.profiles WHERE id=op)<>cash0 OR stt<>'expired'
 THEN RAISE EXCEPTION 'Expiring cron check: first %, second %, status %, expected cash %, got %',
 c1,c2,stt,cash0,(SELECT cash FROM public.profiles WHERE id=op);END IF;
 IF EXISTS(SELECT 1 FROM public.dj_bookings b WHERE b.club_id=cid)
 THEN RAISE EXCEPTION 'Escrow created a scheduled DJ gig';END IF;
 health:=public.dj_finance_release_health();
 IF (health->'counts'->>'total_offers')::int<>2 OR
  (health->'counts'->>'held_cash')::int<>0 OR
  (health->>'finance_invariants_clear')::boolean IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Closed escrow movements failed finance release health monitor';END IF;
 RAISE NOTICE 'DJ finance diagnostic caught corrupted escrow, then passed valid funding and refunds';
END $t$;
ROLLBACK;