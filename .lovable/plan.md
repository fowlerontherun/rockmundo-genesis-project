## Festivals System Expansion Plan

Turn festivals into a marquee event with full ownership economics, deep booking/finance/operations tooling, and a unified admin console. Players can either apply to play at NPC/admin-run festivals or purchase and personally operate their own.

### 1. Ownership & Marketplace (new)

- Extend `public.festivals` with:
  - `owner_type` ('system' | 'player' | 'company'), `owner_profile_id`, `owner_company_id`
  - `sale_status` ('not_for_sale' | 'listed' | 'sold'), `list_price`, `annual_operating_cost`, `prestige_tier` (1–5)
  - `founded_year`, `next_edition_start`, `edition_number`, `cancellation_reason`
- New tables:
  - `festival_sale_listings` — active for-sale festivals (price, listed_by, notes)
  - `festival_purchase_offers` — player bids on system/player festivals
  - `festival_ownership_history` — audit of transfers
  - `festival_staff` — festival-owned staff: promoters, bookers, safety officers, medics, sound engineers (wage, morale, skill)
  - `festival_insurance_policies` — coverage type, premium, payout ceiling, weather rider
  - `festival_permits` — city permit status, permit fee, safety inspection date
- RPC: `purchase_festival(festival_id, buyer_profile_id)` — transfers ownership, moves treasury, logs history.

### 2. Owner Operations Console (new player page)

New route `/festivals/manage/:festivalId` (owner-only) with tabs:

- **Overview** — key KPIs, current edition status, checklist (permits, insurance, minimum booked bands, staffing).
- **Booking** — send/receive slot offers, review applications, drag-and-drop stage schedule builder over `festival_stage_slots`, set headliner, negotiate fees via existing `festival_offer_negotiations`.
- **Stages & Production** — add/remove stages, choose capacity, rent stage equipment (ties into `stage_equipment_catalog`).
- **Tickets & Pricing** — set tiered ticket prices (GA, VIP, weekend, day), presale windows, capacity per stage.
- **Sponsors** — solicit sponsor deals from `sponsorship_brands`, accept/counter offers, tier placement.
- **Staff & Security** — hire/fire festival staff and security firm via `security_contracts`.
- **Finances** — live P&L per edition, cash flow calendar, expense ledger.
- **Marketing** — buy media/radio/DikCok campaigns to drive attendance forecast.
- **Post-event** — reviews, ratings, payout summary, next-edition planner.

### 3. Deep Finances

- Expand `festival_finances` with columns for: staff_wages, security_costs, permit_fees, insurance_premium, stage_rental, equipment_rental, marketing_spend, artist_guarantees, artist_bonuses, sponsor_income, ticket_income_ga, ticket_income_vip, merch_cut_income, food_beverage_income, cleanup_cost, refund_liability, tax_paid.
- New `festival_expense_ledger` (line-item entries with category, amount_cents, party, edition).
- Weekly cron `settle_festival_finances`:
  - Pay staff wages, insurance premium, permit renewals.
  - Post artist guarantees on performance completion.
  - Distribute sponsor payouts on milestones.
  - Deduct festival cut of merch (`festival_merch_sales.festival_cut`) into treasury.
  - Handle refund liability if festival cancels.
- Bankruptcy path: if treasury negative for N weeks → festival auto-listed at fire-sale price, staff unpaid, reputation hit.

### 4. Booking Pipeline Upgrades

- Two-way marketplace: owners post open slots; bands apply. Owners can also directly invite bands via `festival_slot_offers` with guarantee + bonus terms (already partly present — surface fully in UI).
- Requirements per slot: min fame, genre fit, minimum popularity in host country.
- Auto-negotiation NPC logic for system-owned festivals (bands accept/reject based on fame/fee heuristic).
- Rider fulfillment tie-in with existing `gig_rider_fulfillment` + `band_riders` (owner sees costs).
- Conflict detection: prevent double-booking bands across overlapping festivals.

### 5. Gig Gameplay Integration

- Festival performances feed the existing Gig Viewer with a `festival_ground` layout preset and multi-stage backstage view.
- Backstage RP events (`festival_backstage_events`) exposed in the pre-show tab.
- Cross-band rivalry surface (`festival_rivalries`) — bands on same day compete for crowd share; winner earns fame + owner bonus.
- Weather integration (`seasonal_weather_patterns`) impacts attendance and can trigger insurance claims.
- Festival-exclusive merch drops (already in `FestivalExclusiveShop`) tied to owner-set royalty share.

### 6. Unified Admin Console

Consolidate `FestivalAdmin.tsx` + `FestivalsAdmin.tsx` into a single `/admin/festivals` route with tabs:

- **World Roster** — list all festivals (owner type, city, status, next edition, treasury, prestige).
- **Create / Edit** — full form incl. new fields, seed batches by region/genre.
- **Ownership** — force-transfer, put up for auction, seize from inactive owners, set reserve price.
- **Bookings** — global view of all offers/applications, force-approve, mediate disputes.
- **Finances** — cross-festival P&L, subsidy grants, tax rate config.
- **Simulation** — run edition preview (attendance/revenue forecast) and one-click "advance to next edition".
- Delete the redundant legacy pages after migration.

### 7. UI Surfacing

- Add a "Festivals" hub tile linking to `/festivals` browser; browser shows Owned / Attending / Watchlist / Marketplace tabs.
- Landing widget on WorldPulse listing upcoming top-prestige festivals.
- Notifications for: purchase-offer received, slot application received, insurance claim, staff quitting, weather warning.

### Technical Notes

- All new tables use `profile_id` where player-scoped, follow existing RLS/GRANT pattern (`authenticated` + `service_role`).
- Prices stored in cents (`_cents` suffix) with `Math.round(dollars * 100)`.
- Use SECURITY DEFINER for `purchase_festival`, `advance_festival_edition`, `settle_festival_finances`.
- Reuse existing `sponsorship_brands`, `security_contracts`, `stage_equipment_catalog`, `festival_merch_sales`, `festival_backstage_events`, `festival_rivalries` — no duplicate schemas.
- Cron entry added to `cron_job_config` for weekly settlement + daily edition rollover.
- Bump version to **v1.1.499**; add VersionHistory entry.

### Rollout

Delivered in one build session (schema migration → RPCs → owner console → admin unification → hub surfacing → version bump), verified with `npm run typecheck` and Supabase linter.
