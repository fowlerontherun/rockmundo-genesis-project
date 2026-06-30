
# Company System Expansion Plan

## Current State

Rockmundo already has 8 company types: `holding`, `label`, `security`, `factory` (merch), `logistics`, `venue`, `rehearsal`, `recording_studio`. They function mostly as private money sinks — owners pay weekly costs, get internal revenue, but **the world barely changes around them**. NPCs and other players seldom interact with player-owned companies, prices are static, no market share matters, and several categories from Popmundo are missing entirely.

## What Popmundo Does That We Don't

Popmundo treats companies as the **backbone of the simulated world**. Key mechanics worth copying:

1. Companies are publicly listed and rated; every player can shop/use them.
2. Reputation, quality and price drive NPC + player demand (visible "market share").
3. Workers (players) clock in shifts for wages — owner sets shift wage, quality bonus, and tip share.
4. Many more company types tied to lifestyle: bars, restaurants, clothing stores, hotels, hairdressers, instrument shops, tattoo parlours, gyms, hospitals/clinics, newspapers, radio stations, magazines, churches, gambling halls, taxi firms, real-estate agencies, modelling agencies, schools/universities.
5. Companies pay city taxes that feed the city treasury (we have treasury but no inflow from player companies).
6. City laws (mayor) directly affect company tax rate, opening hours, alcohol/age limits.
7. Boards of directors, share issuance, hostile takeovers and stock exchange.

## Plan

### Phase 1 — Make existing companies matter in the world (foundation)

- Add a **public marketplace registry**: every active company surfaces on a city/world directory with reputation, quality, price tier, capacity and "now hiring" flag. NPCs and other players pick services from this registry instead of hard-coded NPCs.
- Add **`company_market_demand`** + nightly resolver that allocates customer volume by `reputation * quality / price * city_population_factor` (Popmundo's core loop).
- Pipe **city tax** from every company's weekly revenue into `city_treasury_ledger` (already exists). Mayor laws drive the rate; `CORPORATE_TAX_RATES` becomes the floor.
- Add **shift work for players** at any company (extends current `company_employees` + `shift_history`): owner posts shifts with wage + skill requirement, players clock in for cash + skill XP. Connects employment system to the company system (today they are separate).
- Add **price controls** owner-side (price tier ↔ demand curve) and **quality investments** (upgrades raise quality stat).

### Phase 2 — Expand each existing type with depth

| Type | New mechanics |
|---|---|
| Label | Public artist scouting board, A&R offers visible to all unsigned bands, label chart share KPI, distribution deals with retail stores (Phase 3). |
| Security | Public bid board for gigs/festivals/clubs; reputation rises with incident-free events; can be hired by mayor for city safety contracts. |
| Merch Factory | Wholesale catalogue listed publicly; quality tier affects every merch order in the world; raw-material supply chain from new Textile/Print suppliers. |
| Logistics | Tour transport bidding marketplace; routes block on weather; can sub-contract to other player companies. |
| Venue | Already public; add booking marketplace open to all bands, dynamic ticket revenue split, residencies. |
| Rehearsal | Hourly booking board; quality tier modifies band cohesion gains. |
| Recording Studio | Public session marketplace, producer roster visible, equipment tier modifies song quality. |
| Holding | Stock issuance, dividends to shareholders, hostile takeover bids on other holdings. |

### Phase 3 — New Popmundo-style company types

Add these as new `company_type` enum values with their own catalogues, upgrades and revenue loops:

1. **Bar / Pub** — sells drinks; NPC traffic by district; can host open-mic; alcohol-law constrained.
2. **Restaurant** — meals restore wellness energy; chef quality drives rating; ties into dating/marriage venues.
3. **Clothing Store / Boutique** — retails player-designed `player_clothing_items`; owner sets price & territory; supplies fashion gigs.
4. **Hotel** — books rooms for touring bands; affects tour fatigue + cost; star rating mechanic.
5. **Hairdresser / Stylist** — modifies avatar look + small charisma buff; appointment slots.
6. **Tattoo Parlour** — already has artists; convert to player-ownable company wrapping `tattoo_parlours`.
7. **Gym** — wellness fitness gains; subscription model + day passes.
8. **Hospital / Clinic** — treats ailments faster; player-owned competes with public hospital; insurance contracts.
9. **Newspaper** — already exists as content table; add owner type so players publish articles, run ads, sway elections.
10. **Radio Station / Magazine / Podcast Network** — convert existing tables into ownable media companies with airplay influence over charts.
11. **Instrument / Gear Shop** — retails `equipment_catalog` items; regional pricing; trade-ins.
12. **Taxi / Rideshare Co.** — short-haul travel inside city; complements logistics.
13. **Real Estate Agency** — brokers `lifestyle_properties` & `housing_market_prices`; earns commission.
14. **Modelling Agency** — already a table; ownable, scouts NPC + player models for `modeling_gigs`.
15. **School / Music Academy** — paid lessons (skill XP) competing with `education_mentors`.
16. **Casino / Gambling Hall** — wraps `casino_transactions`; house edge revenue, addiction risk warnings.
17. **Crypto Exchange / Brokerage** — earns fees on `token_transactions`.
18. **PR / Marketing Agency** — wraps `pr_consultants`; sells campaigns to bands.
19. **Talent Agency** — books gigs/film/tv on behalf of artists for a cut.
20. **Sponsorship Brand Co.** — issues `sponsorship_offers` instead of NPC-only.

### Phase 4 — World impact systems (cross-cutting)

- **City impact**: each company contributes to city `employment_rate`, `nightlife_score`, `culture_score`, `tax_revenue`. Population growth formula already exists — feed these scores into it.
- **Market share & rankings**: extend `company_market_rankings` to all new types; weekly leaderboard per city per type.
- **Rivalries & sabotage**: extend `company_rivalries` to trigger price wars and reputation hits.
- **Mayor laws → companies**: tax rate, minimum wage, opening hours, alcohol licensing affect P&L for relevant types.
- **News loop**: company milestones (IPO, bankruptcy, takeover, hiring spree) auto-publish to `newspapers` + `activity_feed`.
- **Stock exchange (stretch)**: extend `crypto_tokens` table pattern to company shares; daily price based on revenue, reputation, news.

### Phase 5 — UI / discovery

- New **World Companies** directory page (filter by city/type/rating) — like the Cities Treasury page.
- Company detail page gets public-facing "Storefront" tab (services, prices, shifts open, reviews).
- Player profile gets "Career" tab showing shifts worked and shares held.
- Hub tile + sidebar entries under Business module.

## Technical Notes

- New tables: `company_market_demand`, `company_storefront`, `company_shifts`, `company_reviews`, `company_shares`, `company_dividends`, `restaurant_menus`, `bar_inventory`, `hotel_rooms`, `clothing_store_inventory`, `instrument_shop_inventory`, plus a per-type config row in `company_type_definitions`.
- Migrate the `company_type` text column to driven-by-catalogue (`company_type_definitions`) so adding new types no longer needs code-side enum changes; keep TS union as derived.
- Extend `COMPANY_CREATION_COSTS`, `CORPORATE_TAX_RATES`, `COMPANY_TYPE_INFO` to cover all new types.
- New nightly cron `resolve_company_demand` allocates NPC traffic + writes revenue + city tax.
- Public read RLS on storefront/registry tables; owner-only write.
- All money in cents-safe rounding per project memory.
- Update `HowToPlayDialog` Business tab, version bump per release, and `VersionHistory` entry per phase.

## Rollout Order

1. Phase 1 (foundation: registry, shifts, tax pipe, demand resolver).
2. Phase 2 (deepen existing 8 types — one PR per type).
3. Phase 3 in waves: nightlife (bar/restaurant/hotel/casino), retail (clothing/instrument/gear), services (gym/clinic/stylist/tattoo), media (newspaper/radio/magazine), agencies (PR/talent/modelling/real-estate/school), finance (exchange/brokerage).
4. Phase 4 cross-cutting world impact + mayor law hooks.
5. Phase 5 directory + storefront UI.

Each phase ships independently with a version bump and changelog entry.
