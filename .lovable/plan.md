# Merchandise Expansion Plan (v1.1.310 → v1.1.315)

Builds on the existing `player_merchandise`, `merch_orders`, `simulate-merch-sales` engine. Adds depth across the four chosen pillars and wires deeper integration with tours, fans, releases, and city treasuries.

## What's shipping

### 1. Inventory, variants & multi-warehouse
- New `merch_variants` (size, color, sku, stock, cost/price overrides) — orders reference variant when present.
- New `merch_warehouses` per band (city-based) + `merch_warehouse_stock` (variant × warehouse).
- Stock transfer action (cost = distance × per-unit fee, ETA in game-days).
- Reorder thresholds + auto-restock policy per variant (extends the existing manager auto-restock).
- "Stockout" event log feeding the alert panel.

### 2. Pricing, discounts & bundles
- `merch_price_rules`: tiered pricing (qty break), fan-tier discount %, country override, sale windows.
- `merch_bundles`: composite SKUs with their own price; sales engine treats them as atomic SKUs, decrements each component's stock.
- Dynamic pricing helper: suggested price uses recent demand + quality + fame, surfaced in UI.
- Promo code support (band-scoped) usable at gig table & online channel.

### 3. Limited drops & exclusives
- Extend `player_merchandise.is_limited_edition` with `drop_starts_at`, `drop_ends_at`, hard `limited_quantity` enforcement in sim.
- Tour-exclusive items only purchasable while a tour is active (already has `tour_exclusive_tour_id` — wire enforcement).
- Superfan-only flag — gate purchase in sim by customer_type.
- "Signed" upgrade adds quality tier + price multiplier and consumes character action points (manual flow stays in UI).

### 4. Sales channels & analytics
- Channel field already on order (`order_type`); split per-channel allocation: each variant has online/gig/wholesale stock split (% configurable).
- Wholesale orders: new `merch_wholesale_orders` with negotiated discount, larger qty, longer lead time, no city tax.
- Analytics tab gets: channel mix, top variants, sell-through rate, days-of-stock-remaining per variant, attach rate vs gigs in window.
- Forecast widget: 7-day projected revenue using rolling-avg demand × current price.

### 5. Integrations
- **Tours/gigs**: when a gig completes, allocate gig channel revenue to the venue city treasury (already partly done via `home_city_id`; switch merch_sales_tax routing to **order.city** when present, fallback to home_city). Tour exclusives auto-listed at tour venues.
- **Fans & loyalty**: superfan/dedicated tiers get auto-applied % discount; loyalty points table credits purchases.
- **Releases**: release wizard gains a "Companion drop" step → spawns variants tied to release_id; drop window aligns with release.
- **City economy**: tax routing fix above; per-city demand multiplier surfaced in analytics ("hottest cities").

### 6. Engine update
`simulate-merch-sales` extended to:
- Respect variant stock, drop windows, exclusivity flags.
- Apply price rules + fan-tier discounts.
- Resolve order city (tour gig venue → home city) and route tax accordingly.
- Decrement component stock for bundle purchases.

### 7. UI additions
- New **Variants** tab on `Merchandise.tsx` (manage SKUs/sizes/colors).
- New **Drops** tab (limited editions, schedule windows, tour ties).
- New **Pricing** tab (price rules, bundles, promo codes).
- Inventory tab gets warehouse selector + transfer dialog.
- Analytics tab gets channel/forecast widgets.
- Sticky alerts: low stock, expiring drops, oversupply.

### 8. Admin
- Add "Merch markets" tab in admin showing top-selling bands, channel mix, demand heatmap.

## Technical details

### Migrations (one file)
```sql
create table merch_variants ( id uuid pk, merchandise_id uuid fk, sku text, size text, color text,
  stock_quantity int default 0, cost_to_produce_override int, selling_price_override int,
  is_active bool default true, created_at timestamptz default now() );

create table merch_warehouses ( id uuid pk, band_id uuid, city_id uuid, name text, capacity int,
  storage_cost_daily numeric, created_at timestamptz );

create table merch_warehouse_stock ( id uuid pk, warehouse_id uuid, variant_id uuid,
  merchandise_id uuid, stock int default 0, unique(warehouse_id, variant_id) );

create table merch_price_rules ( id uuid pk, merchandise_id uuid, rule_type text
  check(rule_type in ('qty_break','fan_tier','country','sale_window','promo_code')),
  config jsonb, discount_pct numeric, starts_at timestamptz, ends_at timestamptz,
  is_active bool default true );

create table merch_bundles ( id uuid pk, band_id uuid, name text, bundle_price int,
  components jsonb, /* [{merchandise_id, variant_id, qty}] */ is_active bool, stock_calc text );

create table merch_wholesale_orders ( id uuid pk, band_id uuid, buyer_name text, country text,
  total_quantity int, unit_price int, total_price int, discount_pct numeric,
  status text default 'pending', lead_time_days int, created_at timestamptz );

create table merch_stock_transfers ( id uuid pk, band_id uuid, from_warehouse uuid,
  to_warehouse uuid, variant_id uuid, quantity int, cost int, eta timestamptz, status text );

create table merch_stockout_events ( id uuid pk, band_id uuid, merchandise_id uuid,
  variant_id uuid, occurred_at timestamptz default now(), channel text );

alter table player_merchandise
  add column drop_starts_at timestamptz,
  add column superfan_only bool default false,
  add column release_id uuid,
  add column channel_split jsonb default '{"online":50,"gig":40,"wholesale":10}';

alter table merch_orders
  add column variant_id uuid,
  add column bundle_id uuid,
  add column discount_pct numeric default 0,
  add column promo_code text,
  add column city_id uuid;
```
All tables RLS-enabled; SELECT/INSERT/UPDATE policies via `has_band_access(band_id, auth.uid())` helper (already in codebase).

### Edge function changes
- `simulate-merch-sales` rewritten loop to handle variants, bundles, drops, exclusivity, price rules, and per-order city routing.
- New `transfer-merch-stock` function to execute warehouse transfers (charges band, schedules ETA, updates stock on completion via cron).
- New `process-wholesale-orders` cron for fulfilling pending wholesale orders.

### Frontend
- `src/pages/Merchandise.tsx` – add Variants, Drops, Pricing, Warehouses tabs.
- `src/hooks/useMerchVariants.ts`, `useMerchBundles.ts`, `useMerchWarehouses.ts`, `useMerchPriceRules.ts`.
- `src/components/merchandise/` – `VariantManager`, `BundleBuilder`, `PricingRulesPanel`, `WarehousePanel`, `DropsPanel`, `ForecastCard`.
- Release wizard gets a `CompanionMerchStep`.
- Admin `MerchMarketsAdmin.tsx`.

### Versioning
Each shipped slice bumps the version (v1.1.310 inventory/variants → v1.1.315 admin); changelog appended to `VersionHistory.tsx` and shown in `VersionHeader.tsx`.

## Phased rollout
1. **v1.1.310** – Schema migration + variant tab + sim engine variant support.
2. **v1.1.311** – Warehouses, transfers, channel split.
3. **v1.1.312** – Pricing rules, bundles, promo codes.
4. **v1.1.313** – Drops/exclusives enforcement + fan tier discounts.
5. **v1.1.314** – Wholesale + release companion drops + city tax routing fix.
6. **v1.1.315** – Analytics expansions + admin markets dashboard.

## Out of scope (flag for follow-up)
- Real player-to-player merch trading.
- Physical merch shipping minigame.
- 3rd-party retailer NPCs with restock contracts (could be a future "merch distributor" company type).
