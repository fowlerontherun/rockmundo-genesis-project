# Finance Phase 3: Company operations architecture

## Existing findings

Finance Phase 1 already provides the unified `financial_accounts`, `financial_transactions` and immutable `financial_ledger_entries` model, including company owner types and migration of legacy `companies.balance` into ledger-backed company accounts. Finance Phase 2 already provides recurring obligations and scheduled-payment primitives for players and bands. The pre-existing company system included `companies`, `company_settings`, legacy `company_transactions`, direct `companies.balance` mutations, company employees, and specialised business tables for venues, recording studios, rehearsal rooms, merch factories, logistics, labels, security firms and storefront-style services.

This phase consolidates operating finance around the central ledger instead of creating another money system. Legacy company balance fields remain compatibility mirrors only; new movement is represented by company financial accounts, transaction categories, payroll records and auditable capital/dividend records.

## Company account model

Every company uses a primary `financial_accounts` row with `owner_type = 'company'`. The account is separate from owner personal accounts, band accounts, venue accounts, city/country placeholders and system settlement accounts. The account exposes current, available and reserved balances through the Phase 1 generated-balance model.

`company_financial_profiles` stores operating status and snapshot anchors such as reserve target, current liabilities, owner capital and retained earnings. It is not the source of truth for revenue or expenses; those values are derived from the ledger via `company_finance_summary` and weekly snapshots.

## Accounting method

Phase 3 uses simplified cash-basis accounting. Revenue and expenses are recognised when a ledger-backed transfer completes. Owner capital is classified separately from revenue, dividends are separate from payroll, and tax, interest, depreciation and employer-cost values remain placeholders for later phases.

## Revenue recognition

The migration introduces company revenue categories for product sales, service sales, venue bookings, studio bookings, rehearsal bookings, education, transport, management and label commissions. `company_record_service_revenue` is the safe server-side representative integration point: the customer profile account is debited, the company account is credited, idempotency prevents duplicate revenue and related service entities can be linked to the transaction.

Remaining direct balance mutations are documented in `FINANCIAL_FLOW_INVENTORY.md`; broad migration of every legacy storefront and booking path is intentionally deferred to avoid combining too many risky integrations.

## Operating costs

Company recurring costs reuse `recurring_financial_obligations`, now extended to `owner_type = 'company'`. `company_cost_profiles` provides central balancing configuration by company type, including base weekly operating cost, rent, multipliers, recommended staffing, maximum staff and reserve weeks.

Backfill creates one weekly operating-cost obligation per company using its configured cost profile. City and country multipliers are placeholders only.

## Employment model

`employment_role_definitions` defines gameplay-relevant roles, eligible company types, relevant skills, salary guidance, NPC caps, real-player caps and contribution weights. `company_employment_contracts` is the explicit contract record for NPC and real-player employment. `company_employees` stores active employment state, performance, activity and quality contribution.

NPC contracts can activate immediately. Real-player contracts require an offer/acceptance lifecycle before active employment.

## NPC versus real-player employees

NPCs remain accessible and predictable but capped. Real-player employees have higher potential effectiveness when skilled, suitable and recently active, but inactive real-player employees fall back to reduced contribution. The shared calculation in `companyFinanceCalculations.ts` explains each main modifier and applies caps and diminishing returns.

## Job advertisements and applications

`company_job_advertisements` lets authorised companies publish player-facing vacancies with salary, role, requirements, expected activity, deadlines and position count. `company_job_applications` prevents duplicate active applications to the same advert and tracks submitted, review, offer, accepted, rejected and withdrawal states.

Applicants should only see public company reputation and role details, not private financial dashboards.

## Payroll lifecycle

`company_process_payroll` builds a deterministic payroll batch for active/accepted contracts. Payroll totals are calculated server-side from contracts; clients cannot submit gross or net totals. If sufficient company funds exist, the function pays real-player employees through ledger transfers and records NPC wages as company payroll debits. Payroll lines carry idempotency keys to avoid duplicate payment on retry.

## Failed payroll and wage liabilities

If company cash is insufficient, payroll is marked `awaiting_funds`, each unpaid line creates a `company_wage_liabilities` record, and the company enters `payroll_risk`. The process does not create money, does not permit an unauthorised negative balance and does not terminate employees automatically. Owners can inject capital and retry the same payroll idempotently.

## Quality, performance and reputation

Company quality, operating performance and reputation are separate. Quality is the service-capability score, operating performance is current management efficiency and financial/revenue execution, and reputation is public trust and demand influence. Phase 3 stores these separately on `companies` and captures trends in `company_weekly_snapshots`.

## Owner capital, withdrawals and dividends

`company_capital_contributions` records owner funding as capital, not revenue. `company_owner_withdrawal_requests` records owner extraction attempts and is intended to block withdrawals when payroll is unpaid, liabilities are overdue, reserves would be breached or severe distress exists. `company_dividend_declarations` and `company_dividend_allocations` support basic dividends; single-owner allocation is the safe initial path where robust ownership percentages are unavailable.

## Financial distress

Companies can be healthy, watch, cash constrained, payroll risk, delinquent, critical, insolvent, suspended or closed. The classification model considers runway, unpaid payroll, overdue liabilities, repeated failures and negative cash flow. One temporary failed payment should create recoverable distress, not instant liquidation. Forced administration and liquidation are explicitly deferred.

## Scheduled jobs and retry handling

Phase 3 adds schema and idempotent server functions for payroll processing, recurring company expenses, employee performance, snapshots, job expiry, contract expiry and overdue wage checks. Existing cron/job logging patterns should be reused by edge functions when those processors are wired into deployment schedules.

## Security considerations

Private finance tables use RLS foundations from the company ownership and employment model. Server-side functions perform money movement through the central finance service. Clients cannot mark payroll paid, set employee performance as authoritative, submit arbitrary company accounts, bypass withdrawal restrictions, or declare dividends without authorised server-side workflows.

## Known limitations and Phase 4 scope

This phase does not implement corporation tax, VAT, payroll tax, loans, exchange rates, multi-currency company accounts, equity trading, forced administration, liquidation, full accrual accounting, city budgets or macroeconomic simulation. Finance Phase 4 should introduce city-level economic simulation, regional cost differences and local treasury/cost multipliers.
