# D8 — Employment contracts, escrow and disputes

## Purpose

D8 extends the D7 player-company hiring lifecycle with an auditable employment agreement. It reuses the D9 generic social-contract envelope while keeping employment-specific salary, duty, payroll and termination rules in a focused domain model.

## Live database authority

All D8 database changes were applied directly to the live Supabase project. No migration file is included in this branch.

New canonical tables:

- `company_employment_contracts`
- `company_employment_task_evidence`
- `company_employment_payroll`

All three tables have RLS enabled. Authenticated clients have read-only table access; mutations are RPC-only.

## Offer and contract lifecycle

When a D7 application moves to `offer_made`, the vacancy employment terms are snapshotted into `company_job_applications.offer_terms`. Later vacancy edits therefore cannot silently change an outstanding offer.

When the applicant accepts, `respond_to_company_offer` creates the employment row exactly once and creates a linked D9 `employment` social contract. The accepted offer is treated as the employer and employee acceptance evidence. Terms include weekly salary, verified-shift bonus, trial period, optional duration, duties, notice rules, dispute rules and salary-reserve weeks.

## Salary reserve

Where configured, contract creation attempts to reserve up to four weeks of salary from the company Finance account into the D9 system escrow account. Failure to fund the reserve does not invent money: the contract records `reserve_status = unfunded`, making the missing protection visible and auditable.

Normal termination refunds a funded reserve to the company. An employee leaving after recorded non-payment can receive verified arrears from the reserve, bounded by the amount actually held.

## Verified tasks and bonuses

Completed `company_shift_claims` are captured automatically as immutable employment task evidence for the employee's active contract. The configured per-verified-shift bonus is derived from this server event; players cannot self-report bonus work.

## Payroll and non-payment

`process_company_employment_payroll` is a trusted worker/admin boundary. Each `(contract, week)` settles at most once through the canonical Finance journal. It records salary, verified-task bonuses, paid amount, transaction ID and status.

Insufficient company funds create an explicit `unpaid` payroll record, increment consecutive unpaid weeks, suspend the employment as unpaid, and add a D9 evidence event. No silent successful payment is shown to either party.

## Disputes and termination

Employees and company owners can open structured employment disputes for non-payment, breach, wrongful termination or duty disputes. The server snapshots the D9 event stream into the dispute evidence bundle.

Termination is server-authoritative. It updates the employment/domain/social-contract states together, settles the salary reserve according to verified arrears, reopens the linked vacancy where appropriate and records the termination event.

## Player surfaces

- `/employment` now shows the current character's player-company contracts and payroll evidence through the existing company-shift marketplace surface.
- Company → Employees shows the employer view of the same contract, reserve and payroll records.
- Both surfaces can open disputes; employee resignation and employer dismissal route through the D8 contract termination boundary.

## Verification

A rollback-only production test confirmed contract creation, linked D9 contract creation, reserve-state creation and idempotent weekly payroll recording without retaining test data. Live privilege verification confirms all D8 tables are RLS-enabled and authenticated users have SELECT but no direct INSERT/UPDATE/DELETE authority.
