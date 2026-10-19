-- Read-only audit of the twelve RockMundo BOTB production migrations.
-- Expected versions/names come directly from SQL filenames in main.
WITH expected(version,name) AS (
  VALUES
    ('20261019090000','mayor_controlled_battle_of_the_bands'),
    ('20261019090500','botb_city_local_weekday_scheduling'),
    ('20261019091000','lock_botb_mayor_settings_writes'),
    ('20261019120000','botb_shared_finance_forecasts'),
    ('20261019120500','botb_same_city_day_dedup'),
    ('20261019131500','botb_due_and_scheduler_serialization'),
    ('20261019135000','botb_city_scoped_schedule_generation'),
    ('20261019135500','botb_atomic_entry_withdrawal'),
    ('20261019140500','botb_legacy_withdrawal_cutoff_policy'),
    ('20261019141000','botb_isolated_batch_settlements'),
    ('20261019141500','botb_earnings_one_prize_per_event'),
    ('20261019142000','botb_completed_accounting_invariant')
), verified AS (
  SELECT x.version,x.name,
    EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m
      WHERE m.version=x.version AND m.name=x.name) AS deployed_correctly,
    (SELECT cardinality(m.statements)
     FROM supabase_migrations.schema_migrations m
     WHERE m.version=x.version) AS statement_count
  FROM expected x
)
SELECT version,name,deployed_correctly,statement_count
FROM verified ORDER BY version;

WITH expected(version,name) AS (
  VALUES
    ('20261019090000','mayor_controlled_battle_of_the_bands'),
    ('20261019090500','botb_city_local_weekday_scheduling'),
    ('20261019091000','lock_botb_mayor_settings_writes'),
    ('20261019120000','botb_shared_finance_forecasts'),
    ('20261019120500','botb_same_city_day_dedup'),
    ('20261019131500','botb_due_and_scheduler_serialization'),
    ('20261019135000','botb_city_scoped_schedule_generation'),
    ('20261019135500','botb_atomic_entry_withdrawal'),
    ('20261019140500','botb_legacy_withdrawal_cutoff_policy'),
    ('20261019141000','botb_isolated_batch_settlements'),
    ('20261019141500','botb_earnings_one_prize_per_event'),
    ('20261019142000','botb_completed_accounting_invariant')
)
SELECT COUNT(*) AS expected_count,
  COUNT(*) FILTER(WHERE EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations m
    WHERE m.version=e.version AND m.name=e.name
  )) AS matching_migrations,
  COUNT(*) FILTER(WHERE NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations m
    WHERE m.version=e.version AND m.name=e.name
  )) AS mismatched_migrations
FROM expected e;
