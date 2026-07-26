-- Run only against a disposable, fully migrated local database.
BEGIN;
DO $$
DECLARE v_definition text;
BEGIN
  ASSERT to_regclass('public.festival_configurations') IS NOT NULL;
  ASSERT to_regclass('public.festival_scale_catalogue') IS NOT NULL;
  ASSERT to_regclass('public.festival_configuration_requests') IS NOT NULL;
  ASSERT to_regclass('public.festival_configuration_audit') IS NOT NULL;
  ASSERT (SELECT count(*) = 5 FROM public.festival_scale_catalogue WHERE active);
  ASSERT NOT has_table_privilege('anon','public.festival_configurations','SELECT');
  ASSERT NOT has_table_privilege('authenticated','public.festival_configurations','INSERT');
  ASSERT NOT has_table_privilege('authenticated','public.festival_configurations','UPDATE');
  ASSERT NOT has_function_privilege('anon','public.get_festival_configuration(uuid)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.save_festival_configuration(uuid,integer,jsonb,uuid)','EXECUTE');
  ASSERT has_function_privilege('authenticated','public.get_festival_configuration(uuid)','EXECUTE');
  ASSERT has_function_privilege('authenticated','public.save_festival_configuration(uuid,integer,jsonb,uuid)','EXECUTE');
  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_configurations'::regclass AND conname='festival_configuration_version_positive');
  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_configurations'::regclass AND conname='festival_configuration_dates');
  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.festival_configurations'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE '%festival_company_id%');
  SELECT pg_get_functiondef('public.save_festival_configuration(uuid,integer,jsonb,uuid)'::regprocedure) INTO v_definition;
  ASSERT v_definition LIKE '%configuration_version = p_expected_version%';
  ASSERT v_definition LIKE '%festival_configuration_stale%';
  ASSERT v_definition LIKE '%caller_profile_id%idempotency_key%';
  ASSERT v_definition LIKE '%status = ''succeeded''%';
END $$;
-- RPC behavioural scenarios require authenticated fixture users and are exercised by
-- scripts/festivals/run-company-runtime-gate.sh: owner/admin access, unrelated users,
-- canonical trimming/duration, stale writes, idempotent replay and completion. Keeping
-- this transaction ensures future inline fixtures cannot leak into a developer DB.
ROLLBACK;
