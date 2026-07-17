# Financial flow inventory

| Feature | Current location | Migrated in Phase 1 | Category | Risk | Recommended phase |
|---|---|---:|---|---|---|
| Player starting balances | `profiles.cash`, migration | Yes | `starting_funds` | High | Phase 1 |
| Equipment purchase | `src/hooks/useEquipmentStore.ts` | Yes | `equipment_purchase` | High | Phase 1 |
| Rehearsal booking | `src/hooks/useRehearsalBooking.ts` | Yes | `rehearsal_payment` | High | Phase 1 |
| DikCok fan tips | `src/hooks/useDikCokTips.ts` | Yes | `merchandise_revenue` | Medium | Phase 1 |
| Company owner deposit | `src/hooks/useCompanyFinance.ts` | Yes | `company_revenue` | High | Phase 1 |
| Band weekly pay | `supabase/functions/process-weekly-band-pay/index.ts` | No | `wage_payment` | High | Phase 2 |
| Housing buy/rent/sell | `src/hooks/useHousing.ts` | No | `accommodation_cost` | High | Phase 2 |
| Recording session booking | `src/hooks/useRecordingData.tsx` | No | `recording_studio_payment` | High | Phase 2 |
| Festival tickets/merch | `src/hooks/useFestivalTickets.ts`, `src/components/festivals/merch/*` | No | `ticket_sale`, `merchandise_revenue` | Medium | Phase 2 |
| Streaming royalties | `supabase/functions/update-daily-streams/index.ts` | No | `streaming_royalty` | High | Phase 2 |
| Label balances and advances | `src/components/labels/**`, `supabase/functions/complete-gig/index.ts` | No | `company_revenue`, `gig_payment` | High | Phase 2 |
| Company weekly finances | `supabase/migrations/20260711001000_company_weekly_finances_recruitment.sql`, hooks | No | `company_operating_expense` | High | Phase 2 |
| Travel and tours | `src/hooks/useTours.ts`, `supabase/functions/process-tour-travel/index.ts` | No | `travel_cost` | Medium | Phase 3 |
| Casino/lottery/underworld | `src/hooks/useCasino.ts`, `src/hooks/useLottery.ts`, `src/hooks/useUnderworldStore.ts` | No | `administrative_adjustment`/future categories | Medium | Phase 3 |

## Finance Phase 2 updates

| Flow | Phase 2 status | Canonical category | Notes |
| --- | --- | --- | --- |
| Player finance dashboard summaries | Added | Ledger-derived | Shows weekly cash flow, categories, upcoming payments and tax-period placeholders. |
| Band treasury operating accounts | Added | `starting_funds`, ledger-derived | Band balances are preserved through Phase 1 primary accounts; `bands.band_balance` remains a deprecated compatibility mirror. |
| Member band contributions | Migrated | `band_contribution` | Player-to-band transfers must use `financeService.transfer` with idempotency keys. |
| Band reimbursements | Added | `band_reimbursement` | Request state is separate from payment; payment uses the central finance service. |
| Band revenue distributions | Added | `band_distribution` | Eligible categories are explicit; member contributions and refunds are ineligible. |
| Recurring player and band obligations | Added | `recurring_obligation` plus source category | Server-side processing only; failed attempts do not create negative balances. |
| Weekly player and band snapshots | Added | Ledger-derived | Snapshots are reproducible summaries, not financial truth. |
| Tax period summaries | Added | `tax_placeholder`, `tax_withholding` | Basic aggregation only; country-specific taxes are Phase 3+. |

Remaining direct balance mutations to review include legacy casino flows, some gig completion utilities, label advances, company weekly finance and older edge functions that pre-date the unified finance service.

## Finance Phase 3 company operations update

### Migrated or standardised flows

- Company operating accounts are primary `financial_accounts` rows with `owner_type = 'company'`.
- Legacy company balances are preserved through the Phase 1 opening-balance migration and Phase 3 financial profiles.
- Representative company service revenue is routed through `company_record_service_revenue`, debiting a player account and crediting the company account with idempotency.
- Company weekly operating costs are represented as `recurring_financial_obligations` for `owner_type = 'company'`.
- Company payroll is represented by `company_payroll_batches`, `company_payroll_lines` and ledger-backed wage payments.
- Failed payroll creates `company_wage_liabilities` instead of creating money or allowing unauthorised negative balances.
- Owner investment, withdrawal and dividend records are separated from ordinary revenue and payroll.

### Remaining direct company balance mutations

The following areas still need targeted migration to ledger-only movement in future PRs: legacy hooks that update `companies.balance`, legacy `company_transactions`, company closure transfer behaviour, storefront purchases, food company sales, merch factory worker/equipment payments, recording-studio staff/equipment payments, automated company revenue simulations, share purchases and specialised booking refunds.

### Company types identified for staged integration

Current company-related systems include holding companies, venues, recording studios, rehearsal rooms, merch factories, logistics/transport companies, labels, management businesses, security firms and storefront/product-service companies. Phase 3 provides cost profiles and role foundations for these types but intentionally migrates only representative revenue and payroll paths.

### Missing employee role gameplay

Manager, accountant, marketing, sound-engineer and customer-service roles now have finance/performance definitions. Role-specific actions for teaching, driving, security shifts, production work, publicist activity and festival coordination remain follow-up gameplay integrations.

### Future dependencies

City cost multipliers, country taxation, local labour markets, regional rent, commercial utility prices and macroeconomic demand are deferred to Finance Phase 4 and later tax/economy phases.
