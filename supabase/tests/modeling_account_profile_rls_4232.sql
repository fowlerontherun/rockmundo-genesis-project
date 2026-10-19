-- #4232: production-safe authenticated, multi-character RLS acceptance test.
-- All inserted test offers are rolled back. No existing offers are modified.
BEGIN;
DO $setup$
DECLARE u uuid;a uuid;b uuid;other_character uuid;gig uuid;
BEGIN
 SELECT user_id INTO u FROM public.profiles WHERE deleted_at IS NULL
 GROUP BY user_id HAVING count(*)>=2 ORDER BY user_id LIMIT 1;
 SELECT id INTO a FROM public.profiles
   WHERE user_id=u AND deleted_at IS NULL ORDER BY id LIMIT 1;
 SELECT id INTO b FROM public.profiles
   WHERE user_id=u AND deleted_at IS NULL ORDER BY id DESC LIMIT 1;
 SELECT id INTO other_character FROM public.profiles
   WHERE user_id<>u AND deleted_at IS NULL ORDER BY id LIMIT 1;
 SELECT id INTO gig FROM public.modeling_gigs WHERE is_available ORDER BY id LIMIT 1;
 IF a IS NULL OR b=a OR other_character IS NULL OR gig IS NULL
 THEN RAISE EXCEPTION 'modeling_identity_test_fixture_missing'; END IF;
 PERFORM set_config('test.modeling_u',u::text,true);
 PERFORM set_config('test.modeling_a',a::text,true);
 PERFORM set_config('test.modeling_b',b::text,true);
 PERFORM set_config('test.modeling_other',other_character::text,true);
 PERFORM set_config('test.modeling_gig',gig::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('test.modeling_u'),true);
DO $check$
DECLARE offer uuid;n integer;
BEGIN
 INSERT INTO public.player_modeling_contracts
  (user_id,profile_id,gig_id,status,expires_at)
 VALUES (current_setting('test.modeling_u')::uuid,
         current_setting('test.modeling_a')::uuid,
         current_setting('test.modeling_gig')::uuid,'pending',now()+interval '1 day')
 RETURNING id INTO offer;
 INSERT INTO public.player_modeling_contracts
  (user_id,profile_id,gig_id,status,expires_at)
 VALUES (current_setting('test.modeling_u')::uuid,
         current_setting('test.modeling_b')::uuid,
         current_setting('test.modeling_gig')::uuid,'pending',now()+interval '1 day');
 SELECT count(*) INTO n FROM public.player_modeling_contracts
 WHERE profile_id=current_setting('test.modeling_a')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'character_A_offer_scope_failed'; END IF;
 SELECT count(*) INTO n FROM public.player_modeling_contracts
 WHERE profile_id=current_setting('test.modeling_b')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'character_B_offer_scope_failed'; END IF;
 BEGIN
  INSERT INTO public.player_modeling_contracts(user_id,profile_id,gig_id,status)
  VALUES(current_setting('test.modeling_u')::uuid,
   current_setting('test.modeling_other')::uuid,
   current_setting('test.modeling_gig')::uuid,'pending');
  RAISE EXCEPTION 'foreign_character_offer_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE public.player_modeling_contracts
  SET profile_id=current_setting('test.modeling_b')::uuid WHERE id=offer;
  RAISE EXCEPTION 'modeling_offer_identity_swap_allowed';
 EXCEPTION WHEN others THEN
  IF SQLERRM<>'modeling_contract_identity_immutable' THEN RAISE; END IF;
 END;
 IF has_table_privilege('authenticated','public.player_modeling_contracts','TRUNCATE')
 OR has_table_privilege('authenticated','public.player_modeling_contracts','TRIGGER')
 OR has_table_privilege('anon','public.player_modeling_contracts','TRUNCATE')
 THEN RAISE EXCEPTION 'modeling_unsafe_table_grant_retained'; END IF;
END $check$;
ROLLBACK;
SELECT 'modeling_account_profile_rls_harness_passed' result;
