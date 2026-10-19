-- Isolate function-overload commentary in transaction-scoped synthetic schema.
-- Historical migrations now COMMENT on the specific one-argument overload.
BEGIN;
CREATE SCHEMA dj_reset_overload_test;
CREATE FUNCTION dj_reset_overload_test.purchase_equipment_item(uuid)
RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 1';
CREATE FUNCTION dj_reset_overload_test.purchase_equipment_item(uuid,text,integer,integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 2';
COMMENT ON FUNCTION dj_reset_overload_test.purchase_equipment_item(uuid)
 IS 'Legacy single-argument purchase contract';
COMMENT ON FUNCTION dj_reset_overload_test.purchase_equipment_item(uuid,text,integer,integer)
 IS 'Newer four-argument purchase contract';
DO $check$
BEGIN
 IF obj_description('dj_reset_overload_test.purchase_equipment_item(uuid)'::regprocedure,'pg_proc')
  IS DISTINCT FROM 'Legacy single-argument purchase contract'
 OR obj_description('dj_reset_overload_test.purchase_equipment_item(uuid,text,integer,integer)'::regprocedure,'pg_proc')
  IS DISTINCT FROM 'Newer four-argument purchase contract'
 THEN RAISE EXCEPTION 'Overloaded equipment comments targeted incorrect function signatures';
 END IF;
 RAISE NOTICE 'Exact-signature overload comments succeed when both functions exist';
END $check$;
ROLLBACK;