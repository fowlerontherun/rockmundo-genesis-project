-- Run only against the disposable local test database after migrations.
BEGIN;
DO $$ BEGIN
  ASSERT to_regclass('public.festival_configurations') IS NOT NULL;
  ASSERT to_regclass('public.festival_scale_catalogue') IS NOT NULL;
  ASSERT (SELECT count(*)=5 FROM public.festival_scale_catalogue WHERE active);
  ASSERT NOT has_table_privilege('authenticated','public.festival_configurations','INSERT');
  ASSERT NOT has_table_privilege('authenticated','public.festival_configurations','UPDATE');
  ASSERT has_function_privilege('authenticated','public.get_festival_configuration(uuid)','EXECUTE');
  ASSERT has_function_privilege('authenticated','public.save_festival_configuration(uuid,integer,jsonb,uuid)','EXECUTE');
END $$;
ROLLBACK;
