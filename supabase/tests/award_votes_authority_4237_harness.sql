-- #4237 production-safe smoke: all fixture rows and vote-counter
-- effects are rolled back, and no real ceremony ballot is changed.
BEGIN;
DO $checks$
DECLARE actor uuid; chr uuid; band uuid; foreign_chr uuid; show_id uuid;
 ids uuid[]:=ARRAY[]::uuid[]; nominee_id uuid; vote public.award_votes%rowtype;
 n integer;
BEGIN
 SELECT p.user_id,p.id,b.id INTO actor,chr,band
 FROM public.profiles p JOIN auth.users a ON a.id=p.user_id
 JOIN public.bands b ON b.leader_id=p.id
 WHERE COALESCE(p.is_active,true) AND p.died_at IS NULL LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'no_band_leader_fixture'; END IF;
 SELECT id INTO foreign_chr FROM public.profiles WHERE user_id<>actor LIMIT 1;
 INSERT INTO public.award_shows(show_name,year,status,ceremony_date)
 VALUES('Rollback-only ballot security check',2026,'voting_open',now()+interval '1 day')
 RETURNING id INTO show_id;
 FOR n IN 1..5 LOOP
  INSERT INTO public.award_nominations
    (award_show_id,category_name,nominee_type,nominee_id,nominee_name,user_id,status)
  VALUES(show_id,'Rollback category','player',gen_random_uuid()::text,'Fixture',actor,'shortlisted')
  RETURNING id INTO nominee_id;
  ids:=array_append(ids,nominee_id);
 END LOOP;

 IF has_table_privilege('authenticated','public.award_votes','insert')
   OR has_table_privilege('anon','public.award_votes','insert')
   OR has_function_privilege('anon','public.cast_award_vote(uuid,uuid,text,uuid,uuid)','execute')
   OR NOT has_function_privilege('authenticated','public.cast_award_vote(uuid,uuid,text,uuid,uuid)','execute')
 THEN RAISE EXCEPTION 'ballot_grants_expose_direct_vote'; END IF;

 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  INSERT INTO public.award_votes(nomination_id,voter_type,voter_id,weight)
  VALUES(ids[1],'jury',chr,10000);
  RAISE EXCEPTION 'unsafe_direct_vote_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.cast_award_vote(ids[1],show_id,'jury',chr,NULL);
  RAISE EXCEPTION 'jury_identity_spoof_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.cast_award_vote(ids[1],show_id,'player',foreign_chr,NULL);
  RAISE EXCEPTION 'cross_account_identity_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 vote:=public.cast_award_vote(ids[1],show_id,'player',chr,NULL);
 IF vote.weight<>1 OR vote.voter_account_id<>actor OR vote.voter_type<>'player'
 THEN RAISE EXCEPTION 'server_voter_identity_or_weight_wrong'; END IF;
 BEGIN
  PERFORM public.cast_award_vote(ids[1],show_id,'band',chr,band);
  RAISE EXCEPTION 'same_nomination_via_band_accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 vote:=public.cast_award_vote(ids[2],show_id,'band',chr,band);
 IF vote.weight<>1 OR vote.voter_id<>band OR vote.voter_account_id<>actor
 THEN RAISE EXCEPTION 'band_vote_not_owned_by_account'; END IF;
 PERFORM public.cast_award_vote(ids[3],show_id,'player',chr,NULL);
 BEGIN
  PERFORM public.cast_award_vote(ids[4],show_id,'band',chr,band);
  RAISE EXCEPTION 'fourth_vote_accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 EXECUTE 'RESET ROLE';

 IF (SELECT count(*) FROM public.award_votes WHERE nomination_id=ANY(ids)
    AND voter_account_id=actor)<>3
 THEN RAISE EXCEPTION 'unexpected_account_ballot_total'; END IF;
 IF (SELECT sum(vote_count) FROM public.award_nominations WHERE id=ANY(ids))<>3
 THEN RAISE EXCEPTION 'award_nomination_totals_not_synchronized'; END IF;

 UPDATE public.award_shows SET status='completed' WHERE id=show_id;
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.cast_award_vote(ids[4],show_id,'player',chr,NULL);
  RAISE EXCEPTION 'closed_ballot_accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 EXECUTE 'RESET ROLE';
END $checks$;
ROLLBACK;
SELECT 'award_vote_account_security_passed' result;
