-- Read-only deployment checks for Support Band Marketplace Phase 6.
SELECT to_regclass('public.band_support_reputation') AS reputation_table,
       to_regclass('public.band_support_history') AS history_table,
       to_regclass('public.band_support_relationships') AS relationships_table;

SELECT proname
FROM pg_proc
JOIN pg_namespace n ON n.oid=pg_proc.pronamespace
WHERE n.nspname='public'
  AND proname IN ('record_support_band_history','get_band_support_summary','capture_support_band_history_after_settlement')
ORDER BY proname;

SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid='public.support_band_gig_settlements'::regclass
  AND NOT tgisinternal
  AND tgname='capture_support_band_history_trigger';

SELECT count(*) AS completed_history_rows,
       count(DISTINCT support_band_id) AS support_bands_with_history,
       coalesce(sum(support_payment),0) AS total_support_payments_recorded
FROM public.band_support_history;
