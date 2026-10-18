-- Applied DIRECTLY to production as ledger version 20261018184048
-- under name work_shift_authoritative_minimum_vitals_20261018.
-- The manual authenticated clock-in RPC must not accept a character that is
-- dead, deleted, inactive, below 20 health or below 10 energy.
-- Keep active employment checks, serialized row lock, transaction, and grants.
DO $guard$
DECLARE def text;
DECLARE anchor text := E' IF NOT FOUND THEN RAISE EXCEPTION ''work_profile_not_owned''; END IF;\n';
DECLARE addition text := E' IF NOT FOUND THEN RAISE EXCEPTION ''work_profile_not_owned''; END IF;\n'
  || E' IF p.is_active IS DISTINCT FROM true OR p.deleted_at IS NOT NULL OR p.died_at IS NOT NULL\n'
  || E' THEN RAISE EXCEPTION ''work_character_not_active''; END IF;\n'
  || E' IF coalesce(p.health,100) < 20 OR coalesce(p.energy,100) < 10\n'
  || E' THEN RAISE EXCEPTION ''work_character_not_fit''; END IF;\n';
BEGIN
 SELECT pg_get_functiondef('public.clock_in_work_shift_atomic(uuid,uuid)'::regprocedure) INTO def;
 IF def IS NULL OR position(anchor in def)=0 OR position('work_character_not_fit' in def)>0
 THEN RAISE EXCEPTION 'Unexpected manual shift clock-in function; aborting change'; END IF;
 EXECUTE replace(def,anchor,addition);
 IF position('work_character_not_fit' in pg_get_functiondef('public.clock_in_work_shift_atomic(uuid,uuid)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Work minimum-vitals guard failed to install'; END IF;
END;
$guard$;
REVOKE EXECUTE ON FUNCTION public.clock_in_work_shift_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clock_in_work_shift_atomic(uuid,uuid) TO authenticated;
