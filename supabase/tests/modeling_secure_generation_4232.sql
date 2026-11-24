-- Production-schema-safe generation test: no player rewards and all new offer
-- rows are rolled back. Requires the matching migration.
BEGIN;
DO $setup$
DECLARE v_profile public.profiles%rowtype;
BEGIN
  SELECT * INTO v_profile FROM public.profiles p
  WHERE p.is_active AND p.deleted_at IS NULL AND p.died_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.player_modeling_contracts m
      WHERE m.profile_id=p.id AND m.status IN ('pending','accepted','shooting'))
  ORDER BY p.id LIMIT 1;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'modeling_generation_fixture_missing'; END IF;
  PERFORM set_config('test.modeling_generation_user',v_profile.user_id::text,true);
  PERFORM set_config('test.modeling_generation_profile',v_profile.id::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('test.modeling_generation_user'),true);
DO $check$
DECLARE v_count integer;v_second integer;
BEGIN
  v_count:=public.generate_modeling_offers_secure(
    current_setting('test.modeling_generation_profile')::uuid);
  IF v_count NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'modeling_generation_no_starter_offers'; END IF;
  PERFORM set_config('test.modeling_generation_count',v_count::text,true);
  v_second:=public.generate_modeling_offers_secure(
    current_setting('test.modeling_generation_profile')::uuid);
  IF v_second<>0 THEN RAISE EXCEPTION 'modeling_generation_cooldown_bypassed'; END IF;
END $check$;
SET LOCAL ROLE service_role;
DO $receipts$
DECLARE v_receipts integer;
BEGIN
  SELECT count(*) INTO v_receipts FROM public.modeling_offer_terms t
  WHERE t.profile_id=current_setting('test.modeling_generation_profile')::uuid;
  IF v_receipts<>current_setting('test.modeling_generation_count')::integer THEN
    RAISE EXCEPTION 'modeling_generation_missing_term_receipt'; END IF;
END $receipts$;
ROLLBACK;
SELECT 'modeling_secure_generation_passed' result;
