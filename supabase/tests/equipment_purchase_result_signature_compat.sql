-- Tests the June migration's exact signature guard against a temporary
-- PostgreSQL function. Does not touch real purchases or production finances.
BEGIN;
CREATE FUNCTION pg_temp.equipment_purchase_return_probe(p_id uuid)
RETURNS TABLE (player_equipment_id uuid, remaining_stock integer, new_cash integer)
LANGUAGE sql AS $$ SELECT NULL::uuid, 0, 0 $$;
DO $equipment_purchase_return_contract$
DECLARE
  current_result text;
BEGIN
  IF to_regprocedure('pg_temp.equipment_purchase_return_probe(uuid)') IS NOT NULL THEN
    SELECT pg_get_function_result('pg_temp.equipment_purchase_return_probe(uuid)'::regprocedure)
    INTO current_result;

    IF current_result = 'TABLE(player_equipment_id uuid, remaining_stock integer, new_cash integer)' THEN
      DROP FUNCTION pg_temp.equipment_purchase_return_probe(uuid);
    ELSIF current_result <> 'TABLE(player_equipment_id uuid, remaining_stock integer, new_cash integer, new_fame integer)' THEN
      RAISE EXCEPTION 'Unexpected purchase_equipment_item(uuid) return signature: %', current_result;
    END IF;
  END IF;
END $equipment_purchase_return_contract$;


DO $expect_drop$
BEGIN
 IF to_regprocedure('pg_temp.equipment_purchase_return_probe(uuid)') IS NOT NULL THEN
 RAISE EXCEPTION 'Legacy three-column equipment result was not removed';
 END IF;
END $expect_drop$;
CREATE FUNCTION pg_temp.equipment_purchase_return_probe(p_id uuid)
RETURNS TABLE (player_equipment_id uuid, remaining_stock integer, new_cash integer, new_fame integer)
LANGUAGE sql AS $$ SELECT NULL::uuid, 0, 0, 0 $$;
DO $equipment_purchase_return_contract$
DECLARE
  current_result text;
BEGIN
  IF to_regprocedure('pg_temp.equipment_purchase_return_probe(uuid)') IS NOT NULL THEN
    SELECT pg_get_function_result('pg_temp.equipment_purchase_return_probe(uuid)'::regprocedure)
    INTO current_result;

    IF current_result = 'TABLE(player_equipment_id uuid, remaining_stock integer, new_cash integer)' THEN
      DROP FUNCTION pg_temp.equipment_purchase_return_probe(uuid);
    ELSIF current_result <> 'TABLE(player_equipment_id uuid, remaining_stock integer, new_cash integer, new_fame integer)' THEN
      RAISE EXCEPTION 'Unexpected purchase_equipment_item(uuid) return signature: %', current_result;
    END IF;
  END IF;
END $equipment_purchase_return_contract$;


DO $expect_keep$
BEGIN
 IF pg_get_function_result('pg_temp.equipment_purchase_return_probe(uuid)'::regprocedure)
 <> 'TABLE(player_equipment_id uuid, remaining_stock integer, new_cash integer, new_fame integer)' THEN
 RAISE EXCEPTION 'New equipment result signature changed unexpectedly';
 END IF;
END $expect_keep$;
ROLLBACK;

-- Following a complete database reset the one-argument signature installed
-- by the June migration should expose the four expected result fields.
DO $verify_real_function$
DECLARE signature text;
BEGIN
 IF to_regprocedure('public.purchase_equipment_item(uuid)') IS NULL THEN
 RAISE EXCEPTION 'Expected one-argument equipment purchase migration function';
 END IF;
 SELECT pg_get_function_result('public.purchase_equipment_item(uuid)'::regprocedure)
 INTO signature;
 IF signature <> 'TABLE(player_equipment_id uuid, remaining_stock integer, new_cash integer, new_fame integer)' THEN
 RAISE EXCEPTION 'Unexpected live migrated equipment function result: %',signature;
 END IF;
END $verify_real_function$;
