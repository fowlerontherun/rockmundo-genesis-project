# Finance Phase 5 repository audit: country economies and taxation

## Finance Phases 1–4 present

- Phase 1 defines the unified `financial_accounts`, `financial_transactions`, immutable `financial_ledger_entries`, idempotent `finance_transfer`, owner-account helpers and reversal support in `supabase/migrations/20260717090000_finance_phase1_ledger.sql`.
- Phase 2 adds player and band finance policy, distributions, reimbursements, recurring obligations and the first `tax_period_summaries` placeholder in `supabase/migrations/20260717120000_finance_phase2_player_band_management.sql`.
- Phase 3 adds company accounts, employment contracts, payroll batches/lines, company revenue/expense categories, dividends and company finance summaries in `supabase/migrations/20260717153000_finance_phase3_company_operations.sql`.
- Phase 4 adds city economic profiles, city treasury profiles backed by `financial_accounts`, city grants, local price quoting and city economy integrity views in `supabase/migrations/20260717170000_finance_phase4_city_economies.sql`.

## Existing country data

- Countries are currently represented mainly as free-text `cities.country` values. Finance Phase 4 copies these into `city_economic_profiles.country_code`; despite the column name, it may contain the original country label rather than a normalized ISO code.
- Existing country-specific gameplay appears in charts, radio access, travel, housing multipliers and sales territory features, but not as a single canonical economy/tax model.
- Phase 5 therefore seeds `country_economic_profiles` from distinct city countries and creates a stable generated three-letter gameplay code. The seed is intentionally fictionalised and should be improved by admin balancing rather than treated as real-world tax law.

## Residency and registration data

- Player home/current location data is spread across profile/city/travel features and is not yet reliable enough to infer tax residency solely from travel.
- Bands have membership and finance policies. Headquarters/registration data is partial, so Phase 5 introduces `tax_entity_registrations` with an explicit `residency_basis` instead of deriving tax from temporary travel.
- Companies have owner/headquarters-city concepts in the Phase 3 company model. Phase 5 registers taxable companies against an explicit jurisdiction and leaves robust backfill to admin/server jobs where headquarters data is available.

## Existing tax fields and placeholders

- `financial_transaction_category` already included `tax_placeholder`, and Phase 2 added `tax_withholding` plus `tax_period_summaries` as a lightweight placeholder.
- Company history includes monthly tax records and UI references, but those are not ledger-backed national jurisdiction assessments.
- City fees/taxes use `credit_city_treasury` in older flows and city treasury finance-account support in Phase 4. Phase 5 avoids replacing legacy city tax flows, and adds national tax categories and assessment/payment models on top of the unified ledger.

## Existing deductions and direct fees

- Current direct deductions include city business licence fees, city venue permits, platform/system fees, distribution fees, merch production costs, payroll, rent, utilities, maintenance, marketing, professional services, travel and accommodation.
- Phase 5 centralizes tax treatment in `tax_transaction_classifications`; personal spending is not automatically company-deductible, and owner investments/withdrawals/member contributions are classified as capital/transfers rather than taxable revenue.

## Financial flows requiring tax classification

- Personal: wages, gig earnings, session/teaching-style income, royalties, streaming, merchandise profit, dividends, sponsorships and other earned income.
- Band: gig/ticket/festival/merch/streaming income, member contributions, reimbursements, distributions, operating expenses and capital-like transfers.
- Company: product/service sales, venue/studio/rehearsal/transport/label/management/advertising revenue, payroll, rent, utilities, maintenance, marketing, licence fees, professional services, supplier payments, owner investments, withdrawals and dividends.
- Exempt initially: government grants where configured, refunds, tax payments/refunds, treasury transfers, loan placeholders, administrative corrections and city/national treasury transfers.

## Existing country-specific modifiers

- Phase 4 city indices drive cost, wage, tourism, consumer spending, music demand and infrastructure style effects.
- Phase 5 adds national indices with the documented neutral baseline of 100. Country indices should influence city baselines during future balancing without erasing city-specific differences.

## Currency assumptions

- The unified ledger supports a `default_currency_code`, but `finance_transfer` currently moves USD and writes `currency_code='USD'`.
- Existing UI frequently formats USD directly. Phase 5 stores country/jurisdiction currency codes for future migration safety, but deliberately does not implement FX markets or automatic currency conversion.

## Missing jurisdiction data

- No active country-level tax jurisdiction existed before this PR. Phase 5 creates `tax_jurisdictions`, one active default jurisdiction per country, and explicit `tax_entity_registrations`.
- Sensitive tax identifiers are generated server-side and should not be exposed broadly; RLS limits owner-facing registration reads.

## Migration risks

- Country code generation from free-text country names can collide (for example similar names with the same first three letters). The migration uses `ON CONFLICT` and should be followed by admin cleanup where needed.
- Existing city tax flows are still present and may coexist with national tax. This avoids breaking live flows but means some categories need future routing to prevent double taxation.
- `finance_transfer` remains USD-only internally, so non-USD country currency metadata is descriptive until a later currency/FX programme.
- Legacy `tax_period_summaries` remains for compatibility; new deterministic assessment tables are separate but still ledger-backed.

## Systems that should remain tax-exempt initially

- Player transfers, band contributions, owner investments, loans/placeholders, tax payments, treasury transfers, government grants where configured, refunds of principal, administrative corrections, opening balance migrations, city grants and national grants should not be normal commercial taxable income.
