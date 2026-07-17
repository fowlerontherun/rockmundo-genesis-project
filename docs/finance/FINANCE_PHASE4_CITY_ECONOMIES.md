# Finance Phase 4: city economies, regional costs, local demand and municipal treasuries

## Repository audit findings

Finance Phases 1–3 are present as Supabase migrations and docs: Phase 1 creates `financial_accounts`, `financial_transactions`, ledger entries and owner type `city`; Phase 2 adds recurring obligations; Phase 3 adds company operating profiles, employment contracts, job adverts, payroll batches, wage liabilities and company P&L snapshots.

Current city data is stored in the existing `cities` table, which already carries `name`, `country`, `population`, travel metadata and relationships from venues, gigs, companies, studios, universities, clubs, festivals and player location fields. This PR extends that model rather than creating a parallel city model.

Existing city-linked systems identified include venues/gigs, festivals, company headquarters, night clubs, studios/rehearsals, universities, travel and profile current/home city fields. Existing regional modifiers were scattered: gig completion had a city-name hash economy multiplier, city laws/tax placeholders existed, and several docs listed future city demand/cost hooks. Hard-coded or mostly fixed prices remain for some booking, nightlife, education, food/lifestyle, travel and festival flows; the financial-flow inventory lists them as compatibility work.

Currency assumptions remain USD-first. Phase 4 adds `primary_currency_code` to city profiles and treasuries but does not implement exchange rates or country monetary policy.

## Architecture

The city economy layer is centred on `city_economic_profiles`. All indices use a baseline of `100`: below `100` means cheaper/weaker than world baseline, above `100` means more expensive/stronger. Indices are bounded and validated, never negative, and exposed with player-friendly labels.

City scale is standardised as `town`, `small_city`, `regional_city`, `major_city` and `global_city`. Scale seeds population and opportunity assumptions but does not alone determine outcomes.

Every city receives a primary `financial_accounts` row with owner type `city` and a `city_treasury_profiles` row. Treasury movements use `finance_transfer`, so business licence fees, grants, budget spending and admin adjustments are ledger-backed and idempotency-keyed.

## Calculation model

`city_price_quote` is the common pricing interface. It accepts a base amount, city, category, existing modifier and optional event context, then returns base amount, city multiplier, event multiplier, final minor-unit amount, rounding policy and explanation. The calculation order is:

1. Map category to exactly one city index.
2. Convert the index to bounded basis points.
3. Add bounded temporary event pressure.
4. Apply one existing modifier input.
5. Round once to integer minor units.

This avoids double-applying the same city factor and prevents unbounded multiplicative growth.

`city_wage_guidance` applies the wage index to role definitions and returns recommended, minimum-market and maximum-market wage bands.

`city_local_audience_demand` combines population-derived market size, local demand, consumer spending, tourism, genre popularity, fame, price sensitivity, venue capacity and competition. It returns estimated audience, confidence range and positive/negative modifier explanations. Demand modifies probability and capacity expectations; it does not guarantee revenue.

## Data model introduced

- `city_economic_profiles`
- `city_treasury_profiles`
- `city_budgets`
- `city_economic_snapshots`
- `city_genre_demands`
- `city_temporary_effects`
- `city_spending_initiatives`
- `city_grant_programmes`
- `city_grant_applications`
- `city_grant_awards`
- `city_licence_schedules`
- `city_economic_audit_events`

Integrity is surfaced through `city_economy_integrity_issues` for missing profiles, missing treasuries, invalid indices, expired active effects and paid grants without transactions.

## Systems integrated in this PR

- Company business licence fees can be collected from company accounts into city treasuries.
- Commercial rent, residential rent, utilities, accommodation, fuel, transport, cost-of-living and wage guidance use the shared city quote service.
- Company payroll guidance varies by city through wage indices.
- Event pressure can temporarily affect demand and accommodation/transport-style categories within caps.
- City genre demand seeds non-identical genre popularity by city.
- Grants transfer funds from city treasury to player, band, company or venue recipients exactly once.
- Economic snapshots aggregate city profile data, company counts, active employees, vacancies, gigs, payroll and treasury balance.

## Admin, security and observability

Ordinary players receive read-only access to public city profile, public treasury summaries, genre demand, public snapshots, active effects and open/closed grant programmes. Direct writes are intentionally absent from RLS policies. Trusted server-side functions perform treasury transfers, grant payments, licence collection and snapshot generation.

Admin adjustments should be implemented as audited finance operations, not direct balance edits. `city_economic_audit_events` stores immutable changes and reasons.

## Migration strategy

`ensure_city_economy_foundations()` backfills every existing city with a gameplay-balanced profile and primary treasury account while preserving city IDs. Baselines are generated from existing population and metadata only; values are fictionalised for game balance and are not real-world economic claims. Default business licence schedules and varied genre demand are inserted idempotently.

Legacy regional fields and hard-coded prices are preserved until each call site is safely migrated. New services are designed to prevent applying both legacy and new modifiers in the same calculation.

## Scheduled processing

The migration provides idempotent primitives for weekly snapshots and effect status rollups. A scheduler should call snapshot generation weekly per city, update active/expired temporary effects, recalculate tourism and business confidence, update employment aggregation, roll budgets and publish major city economic news when trend thresholds are crossed.

## Known limitations

- No country-level taxes, VAT, monetary policy, live exchange rates or national treasury logic.
- No autonomous NPC municipal government.
- No full housing ownership or inventory model.
- Some existing UI routes still need to replace fixed display prices with `city_price_quote` results.
- Screenshots were not produced in this non-interactive implementation environment.

## Recommended Finance Phase 5

Implement country-level taxation and national economies: country treasury accounts, tax jurisdictions, income tax, band/company taxation, payroll withholding, VAT/sales tax, tax periods/returns, national profiles, country grants and tax distribution between city and country.
