

# Finances Overhaul — Charity, Sponsorship Types & City Treasury (v1.1.185)

## Summary
Enhance the Finances page with deeper personal/band breakdowns, add in-game charity donations, introduce typed sponsorships with distinct bonuses, and create a city treasury system for future mayor spending.

## Database Changes (1 migration)

### New Tables

1. **`charity_organizations`** — Catalog of in-game charities
   - `id`, `name`, `category` (music_education, health, environment, humanitarian, arts), `description`, `fame_bonus_pct` (int), `reputation_boost` (int), `tax_deduction_pct` (int), `is_active`, `logo_url`, `created_at`
   - Seeded with ~12 charities (e.g. "Music for Youth Foundation", "Green Planet Initiative", "Artists Against Hunger")

2. **`charity_donations`** — Player donation history
   - `id`, `profile_id` (FK profiles), `charity_id` (FK charity_organizations), `amount` (int), `fame_gained` (int), `reputation_gained` (int), `created_at`
   - RLS: users can read/insert own rows

3. **`sponsorship_types`** — Defines sponsorship categories with bonuses
   - `id`, `name` (e.g. "Gear Endorsement", "Energy Drink", "Fashion Brand", "Tech Partner", "Streaming Platform", "Automotive"), `category`, `fame_multiplier` (numeric), `streaming_bonus_pct` (int), `merch_discount_pct` (int), `gig_pay_bonus_pct` (int), `tour_cost_reduction_pct` (int), `description`, `icon_name` (text), `created_at`
   - Seeded with 6 distinct types, each with unique bonus profiles

4. **`city_treasury`** — Per-city financial tracking
   - `id`, `city_id` (FK cities, unique), `balance` (bigint default 0), `total_tax_collected` (bigint default 0), `total_spent` (bigint default 0), `tax_rate_pct` (int default 10), `last_collection_at`, `created_at`, `updated_at`
   - RLS: public read, insert/update restricted
   - Seeded for all 180 cities with starting balances based on city population

5. **`city_treasury_ledger`** — Transaction log for city finances
   - `id`, `city_id` (FK cities), `amount` (int), `type` (tax_collection, mayor_spending, grant, event_cost, infrastructure), `description`, `reference_id` (uuid nullable), `created_at`

### Altered Tables
- **`sponsorship_offers`**: Add `sponsorship_type_id` (FK sponsorship_types, nullable) so offers carry a type
- **`sponsorship_contracts`**: Add `sponsorship_type_id` (FK sponsorship_types, nullable) for active bonus tracking

## New UI Components

1. **`src/components/finance/PersonalFinanceBreakdown.tsx`**
   - Detailed personal finance card: cash, property value, vehicle value, gear value, total assets
   - Liabilities section: active loans, pending payments
   - Net worth calculation with visual bar

2. **`src/components/finance/BandFinanceDetail.tsx`**
   - Expanded band view: income by source (gigs, merch, streaming, sponsorships), expense breakdown (payroll, equipment, travel)
   - Per-band profit/loss indicator

3. **`src/components/finance/CharityDonationsTab.tsx`**
   - Browse charities with category filters
   - Each charity card shows: name, description, bonuses (fame %, reputation boost, tax deduction %)
   - "Donate" dialog with amount input, shows projected bonuses
   - Donation history table

4. **`src/components/finance/SponsorshipTypesPanel.tsx`**
   - Display all 6 sponsorship types with their unique bonuses in a grid
   - Each type shows: icon, name, and bonus breakdown (fame multiplier, streaming %, merch discount, gig pay %, tour cost reduction)
   - Active sponsorship contracts grouped by type with total bonus summary

5. **`src/components/finance/CityTreasuryCard.tsx`**
   - Shows the player's current city treasury: balance, tax rate, recent collections
   - Read-only for now (mayor spending comes later)
   - Mini ledger of recent treasury transactions

## Files to Modify

- **`src/pages/Finances.tsx`** — Add new tabs: "Charity", "Sponsorships", "City Treasury". Enhance Overview with PersonalFinanceBreakdown
- **`src/hooks/useFinances.ts`** — Add queries for charity organizations, player donations, sponsorship types, and city treasury data
- **`src/components/finance/FinanceSummaryCards.tsx`** — Add "Total Donated" or "Active Sponsorships" as additional summary metrics
- **`src/components/finance/BandFinancesCard.tsx`** — Replace with richer BandFinanceDetail showing income/expense split
- **`src/lib/api/sponsorships.ts`** — Add sponsorship type fetching and type-aware contract queries
- **`src/components/VersionHeader.tsx`** — Bump to 1.1.185
- **`src/pages/VersionHistory.tsx`** — Add changelog entry

## Sponsorship Types & Bonuses

| Type | Fame × | Stream % | Merch Discount | Gig Pay % | Tour Cost % |
|------|--------|----------|---------------|-----------|-------------|
| Gear Endorsement | 1.05 | 0 | 15 | 0 | 0 |
| Energy Drink | 1.10 | 5 | 0 | 10 | 0 |
| Fashion Brand | 1.15 | 0 | 20 | 5 | 0 |
| Tech Partner | 1.05 | 10 | 0 | 0 | 10 |
| Streaming Platform | 1.0 | 25 | 0 | 0 | 0 |
| Automotive | 1.10 | 0 | 0 | 0 | 25 |

## Implementation Order
1. Migration: all new tables + seeds + column additions
2. PersonalFinanceBreakdown + BandFinanceDetail components
3. CharityDonationsTab with donation logic (deduct cash, record donation, apply fame/reputation)
4. SponsorshipTypesPanel with type display and active bonus summary
5. CityTreasuryCard (read-only display, seeded data)
6. Update Finances page with new tabs
7. Version bump + changelog

