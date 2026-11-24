-- Read-only: compare the company summary balance with the primary financial ledger.
-- Never run an UPDATE using these differences alone: establish the source of drift.
WITH primary_accounts AS (
  SELECT owner_id AS company_id, current_balance_minor, reserved_balance_minor
  FROM public.financial_accounts
  WHERE owner_type = 'company' AND is_primary = true
),
comparison AS (
  SELECT c.id, c.name, c.status, c.company_type, c.balance AS company_balance,
         a.current_balance_minor,
         a.reserved_balance_minor,
         (round(c.balance * 100)::bigint - a.current_balance_minor) AS difference_minor
  FROM public.companies c
  LEFT JOIN primary_accounts a ON a.company_id = c.id
)
SELECT id, name, status, company_type, company_balance, current_balance_minor,
       reserved_balance_minor, difference_minor,
       CASE
         WHEN current_balance_minor IS NULL THEN 'missing_primary_account'
         WHEN difference_minor <> 0 THEN 'ledger_mismatch'
         WHEN reserved_balance_minor <> 0 THEN 'reserved_funds'
         ELSE 'balanced'
       END AS reconciliation_status
FROM comparison
ORDER BY reconciliation_status, id;

-- Compare active operating obligations to staffing and shift activity.
SELECT c.id, c.name,
  (SELECT count(*) FROM public.company_employees e
   WHERE e.company_id = c.id AND e.status = 'active') AS active_employees,
  (SELECT count(*) FROM public.company_employment_contracts e
   WHERE e.company_id = c.id AND e.status NOT IN ('terminated','cancelled','expired')) AS open_employment_contracts,
  (SELECT count(*) FROM public.company_shifts s
   WHERE s.company_id = c.id) AS shifts_created,
  (SELECT count(*) FROM public.company_shift_claims cl
   JOIN public.company_shifts s ON s.id = cl.shift_id
   WHERE s.company_id = c.id AND cl.status = 'claimed') AS claimed_unfinished_shifts,
  (SELECT count(*) FROM public.company_tax_records t
   WHERE t.company_id = c.id AND t.status IN ('pending','overdue')) AS unpaid_tax_records
FROM public.companies c
WHERE c.status <> 'dissolved'
ORDER BY c.id;
