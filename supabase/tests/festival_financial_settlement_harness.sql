-- Phase 9A structural and invariant harness. Run after the full migration chain.
BEGIN;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='festival_financial_settlements') THEN RAISE EXCEPTION 'settlement aggregate missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='festival_settlement_lines_work_idx') THEN RAISE EXCEPTION 'stable work-order index missing';END IF;
 IF has_table_privilege('authenticated','public.festival_settlement_payments','INSERT') THEN RAISE EXCEPTION 'direct payment writes exposed';END IF;
 IF NOT has_function_privilege('authenticated','public.prepare_festival_settlement(uuid,integer,uuid)','EXECUTE') THEN RAISE EXCEPTION 'prepare RPC unavailable';END IF;
 IF NOT has_function_privilege('authenticated','public.execute_festival_settlement(uuid,integer,uuid)','EXECUTE') THEN RAISE EXCEPTION 'execute RPC unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='festival_financial_settlements_runtime_session_id_key') THEN RAISE EXCEPTION 'one settlement per runtime not enforced';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_settlement_lines'::regclass AND contype='u') THEN RAISE EXCEPTION 'source exactly-once constraint missing';END IF;
 IF position('finance_transfer' in pg_get_functiondef('public._process_festival_settlement_line(uuid,uuid)'::regprocedure))=0 THEN RAISE EXCEPTION 'canonical finance boundary not used';END IF;
 IF position('festival_settlement_receipts' in pg_get_functiondef('public._process_festival_settlement_line(uuid,uuid)'::regprocedure))=0 THEN RAISE EXCEPTION 'exactly-once receipts missing';END IF;
 IF position('runtime_outcome_digest' in pg_get_functiondef('public.execute_festival_settlement(uuid,integer,uuid)'::regprocedure))=0 THEN RAISE EXCEPTION 'immutable review revalidation missing';END IF;
END$$;
ROLLBACK;
