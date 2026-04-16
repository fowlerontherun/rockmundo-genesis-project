

# Expand Record Labels & Companies — Deeper Impact Plan

## Current State
Labels have: roster management, contracts, demos, releases, marketing budgets, staff, upgrades, P&L finance, and royalty tracking. Companies have: subsidiaries, synergies (display-only), tax records, employees, fund transfers, and empire dashboards. However, the systems are largely self-contained — labels and companies don't meaningfully affect the broader game (artist fame growth, release success, gig opportunities, etc.).

## What This Plan Adds

### 1. Label Tier & Prestige System
Add a `label_tier` column to `labels` (indie → independent → mid-major → major → mega-label) calculated from reputation + roster + revenue. Tier determines:
- **Contract appeal**: Higher-tier labels attract better artists (lower rejection rates)
- **Distribution reach**: Automatic territory multipliers on release sales
- **Marketing effectiveness**: Tier multiplier on hype generation (1x → 3x)
- **Advance pool scaling**: Higher tiers can offer bigger advances

New component: `LabelTierBadge.tsx` displayed on label pages and artist contract views.

### 2. Label Impact on Artist Careers
New table: `label_artist_boosts` — tracks active bonuses a label provides to signed artists:
- **Fame growth bonus**: +5-25% passive fame gain based on label tier + marketing spend
- **Streaming multiplier**: Label distribution deals multiply streaming revenue
- **Gig booking boost**: Signed artists get better gig offers (venue quality, pay)
- **Festival priority**: Labels can lobby for festival slots for their artists

Update the artist's release sales/streaming calculations to factor in label tier and active marketing campaigns. This makes signing with a good label genuinely impactful.

### 3. Company Revenue Generation
Currently companies mostly spend money. Add actual revenue-generating mechanics:

New table: `company_service_contracts` — companies can bid on and win service contracts:
- **Security firms**: Contracted for venue events, festival security, artist protection
- **Factories**: Merch production orders from bands and labels
- **Logistics**: Tour equipment transport, merch shipping
- **Venues**: Booking revenue from external artists
- **Studios**: Session bookings from non-owned artists

New component: `CompanyContractBoard.tsx` — a marketplace of available service contracts companies can bid on.

### 4. Company Reputation & Market Influence
Add `market_influence` column to `companies`. High-influence companies:
- Get priority on service contracts
- Reduce operating costs (-5% per influence tier)
- Unlock exclusive partnerships
- Can poach staff from rival companies

New table: `company_rivalries` — tracks competitive relationships between companies owned by different players, affecting pricing and contract availability.

### 5. Label A&R Intelligence
Enhance the scouting system so A&R staff actively discover talent:

New table: `label_scout_reports` — A&R staff automatically generate weekly reports on unsigned artists in the label's HQ city, rating their potential based on fame, song quality, and genre fit. Label owners can then fast-track contract offers.

New component: `ScoutReportsPanel.tsx` in the label management page.

### 6. Company Events & Milestones
New table: `company_events` — significant events that affect company operations:
- Awards for "Label of the Year" based on combined artist success
- Scandals (random events) that tank reputation temporarily
- Acquisition offers from NPC mega-corporations
- IPO milestones when company value exceeds thresholds

New component: `CompanyEventsTimeline.tsx` shown on the company detail page.

### 7. Cross-Company Artist Development Pipeline
Labels connected to recording studios and rehearsal spaces via the same holding company get an **Artist Development** pipeline:
- New artists go through: Scouting → Demo Recording (studio) → Rehearsal (rehearsal space) → Release (label) → Tour (logistics + venues)
- Each stage tracked in a new `artist_development_pipeline` table
- Completing the full pipeline grants bonus fame and a "Label Developed" badge

New component: `ArtistDevelopmentTracker.tsx` in label management.

## Database Changes (8 new tables, 2 altered)

### New Tables
1. `label_artist_boosts` — active bonuses per contract (fame_bonus_pct, streaming_multiplier, gig_boost_pct)
2. `label_scout_reports` — weekly A&R discoveries (artist_id, potential_score, genre_match, recommended_at)
3. `company_service_contracts` — revenue contracts (company_id, client_type, service_type, value, duration, status)
4. `company_rivalries` — competitive tracking (company_a_id, company_b_id, intensity, started_at)
5. `company_events` — milestones and random events (company_id, event_type, description, impact_value, occurred_at)
6. `artist_development_pipeline` — development stages (label_id, artist_id, current_stage, started_at, completed_stages JSONB)
7. `label_genre_expertise` — label specialization tracking (label_id, genre, expertise_level, releases_in_genre)
8. `company_market_rankings` — weekly snapshot of company rankings by type

### Altered Tables
- `labels`: Add `label_tier` (text), `total_artists_developed` (int), `genre_specialization` (text[])
- `companies`: Add `market_influence` (int), `total_contracts_won` (int)

## New UI Components
1. `src/components/labels/LabelTierBadge.tsx` — Visual tier indicator
2. `src/components/labels/management/ScoutReportsPanel.tsx` — A&R discoveries
3. `src/components/labels/management/ArtistDevelopmentTracker.tsx` — Pipeline view
4. `src/components/labels/management/LabelGenreExpertise.tsx` — Genre specialization display
5. `src/components/company/CompanyContractBoard.tsx` — Service contract marketplace
6. `src/components/company/CompanyEventsTimeline.tsx` — Event history
7. `src/components/company/CompanyRivalries.tsx` — Rival tracking
8. `src/components/company/MarketRankings.tsx` — Leaderboard by company type

## Files to Modify
- `src/pages/LabelManagement.tsx` — Add Scout Reports, Development Pipeline, Genre Expertise tabs
- `src/pages/CompanyDetail.tsx` — Add Contract Board, Events, Rivalries, Rankings tabs
- `src/pages/MyCompanies.tsx` — Show market influence and rankings
- `src/components/labels/LabelDirectory.tsx` — Show tier badges
- `src/components/labels/MyContractsTab.tsx` — Show active label boosts
- `src/utils/releasePredictions.ts` — Factor in label tier multipliers
- `src/components/company/CompanySynergies.tsx` — Connect to artist development pipeline
- `src/pages/VersionHistory.tsx` — Changelog
- `src/components/VersionHeader.tsx` — Version bump

## Implementation Order
1. Migration: new tables + column additions
2. Label tier system + badge component
3. Label artist boosts + integration with release predictions
4. Scout reports panel
5. Company service contracts marketplace
6. Company events timeline
7. Artist development pipeline
8. Market rankings and rivalries
9. Version bump and changelog

