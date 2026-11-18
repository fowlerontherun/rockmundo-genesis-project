-- Run only after atomic_modeling_booking_settlement has been applied.
-- This is a read-only privilege/shape gate: it creates no player rewards.
BEGIN;
DO $gate$
BEGIN
  IF has_table_privilege('authenticated','public.player_modeling_contracts','INSERT')
     OR has_table_privilege('authenticated','public.player_modeling_contracts','UPDATE')
  THEN RAISE EXCEPTION 'modeling_browser_can_forge_contract'; END IF;
  IF NOT has_table_privilege('authenticated','public.player_modeling_contracts','SELECT')
  THEN RAISE EXCEPTION 'modeling_browser_cannot_read_contract'; END IF;
  IF has_table_privilege('authenticated','public.modeling_offer_terms','INSERT')
     OR has_table_privilege('authenticated','public.modeling_contract_settlements','INSERT')
  THEN RAISE EXCEPTION 'modeling_browser_can_forge_payment_receipt'; END IF;
  IF has_function_privilege('anon','public.book_modeling_offer_atomic(uuid,uuid,timestamptz,timestamptz,date)','EXECUTE')
     OR has_function_privilege('anon','public.generate_modeling_offers_secure(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.settle_modeling_contract_atomic(uuid,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.settle_modeling_contract_atomic(uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'modeling_privileged_rpc_exposed'; END IF;
  IF NOT has_function_privilege('authenticated',
    'public.book_modeling_offer_atomic(uuid,uuid,timestamptz,timestamptz,date)','EXECUTE')
    OR NOT has_function_privilege('service_role',
    'public.settle_modeling_contract_atomic(uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'modeling_rpc_grants_missing'; END IF;
  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.modeling_contract_settlements'::regclass AND contype='p')<>1
  THEN RAISE EXCEPTION 'modeling_receipt_primary_key_missing'; END IF;
END $gate$;
ROLLBACK;
