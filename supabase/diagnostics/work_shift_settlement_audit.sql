-- #4216 production-safe READ-ONLY work payroll audit.
-- Never auto-pay, replay, reverse or delete legacy entries based on this report.
-- Run before and after each settlement deployment; investigate any anomaly.
WITH xp_by_shift AS (
 SELECT metadata->>'shift_id' shift_id, count(*) xp_entries, sum(xp_amount) total_xp
 FROM public.experience_ledger
 WHERE activity_type='work_shift' AND metadata ? 'shift_id'
 GROUP BY 1
), city_tax_by_shift AS (
 SELECT reference_id shift_id, count(*) tax_entries, sum(amount) total_tax
 FROM public.city_treasury_ledger
 WHERE type='employment_income_tax' AND reference_id IS NOT NULL
 GROUP BY 1
), receipt_audit AS (
 SELECT s.shift_id,
  coalesce(x.xp_entries,0) xp_entries,
  coalesce(t.tax_entries,0) tax_entries,
  coalesce(t.total_tax,0) ledger_tax,
  s.city_tax receipt_tax,
  s.xp_earned receipt_xp,
  coalesce(x.total_xp,0) ledger_xp,
  sh.status shift_status
 FROM public.work_shift_settlements s
 LEFT JOIN xp_by_shift x ON x.shift_id=s.shift_id::text
 LEFT JOIN city_tax_by_shift t ON t.shift_id=s.shift_id
 LEFT JOIN public.shift_history sh ON sh.id=s.shift_id
)
SELECT 'receipts_with_inconsistent_xp_tax_or_status' finding,count(*) incidents
FROM receipt_audit
WHERE xp_entries<>1 OR ledger_xp IS DISTINCT FROM receipt_xp
 OR (receipt_tax=0 AND tax_entries<>0)
 OR (receipt_tax>0 AND (tax_entries<>1 OR ledger_tax IS DISTINCT FROM receipt_tax))
 OR shift_status IS DISTINCT FROM 'completed'
UNION ALL
SELECT 'legacy_duplicate_shift_xp',count(*) FROM xp_by_shift WHERE xp_entries>1
UNION ALL
SELECT 'legacy_duplicate_shift_city_tax',count(*) FROM city_tax_by_shift WHERE tax_entries>1
UNION ALL
SELECT 'in_progress_without_matching_active_activity',count(*)
FROM public.shift_history sh
WHERE sh.status='in_progress' AND NOT EXISTS (
 SELECT 1 FROM public.profile_activity_statuses a
 WHERE a.activity_type='work_shift' AND a.status='active'
  AND a.profile_id=sh.profile_id AND a.metadata->>'shift_history_id'=sh.id::text
)
UNION ALL
SELECT 'completed_without_atomic_receipt',count(*)
FROM public.shift_history sh
WHERE sh.status='completed' AND NOT EXISTS (
 SELECT 1 FROM public.work_shift_settlements s WHERE s.shift_id=sh.id
);

-- The following rows are forensic review material, NOT a payout/reversal plan.
-- Aggregate once before correlating tax entries: PostgreSQL disallows references
-- to ungrouped x.metadata in a grouped query's correlated subquery.
WITH duplicate_xp AS (
 SELECT x.metadata->>'shift_id' AS shift_id, count(*) AS xp_rows,
        array_agg(x.xp_amount ORDER BY x.created_at, x.id) AS xp_amounts
 FROM public.experience_ledger x
 WHERE x.activity_type='work_shift' AND x.metadata ? 'shift_id'
 GROUP BY x.metadata->>'shift_id'
 HAVING count(*)>1
)
SELECT d.shift_id, d.xp_rows, d.xp_amounts, coalesce(t.tax_rows,0) AS tax_rows
FROM duplicate_xp d
LEFT JOIN LATERAL (
 SELECT count(*) AS tax_rows
 FROM public.city_treasury_ledger c
 WHERE c.type='employment_income_tax'
   AND c.reference_id::text=d.shift_id
) t ON true
ORDER BY d.shift_id;

SELECT date_trunc('month',sh.clock_in_time) started_month,count(*) orphaned_shifts,
 count(*) FILTER (WHERE EXISTS (
  SELECT 1 FROM public.experience_ledger xp WHERE xp.activity_type='work_shift'
   AND xp.metadata->>'shift_id'=sh.id::text)) with_xp_ledger
FROM public.shift_history sh
WHERE sh.status='in_progress' AND NOT EXISTS (
 SELECT 1 FROM public.profile_activity_statuses a
 WHERE a.activity_type='work_shift' AND a.status='active'
  AND a.profile_id=sh.profile_id AND a.metadata->>'shift_history_id'=sh.id::text
)
GROUP BY 1 ORDER BY 1;
