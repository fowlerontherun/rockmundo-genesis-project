

## Fix Merchandise Sales Display & Data Issues

### Problems Found

1. **`simulate-merch-sales` not in `config.toml`** — the edge function exists but isn't registered, so it may not be deployed/invocable properly.

2. **Supabase 1000-row query limit** — `useMerchSalesAnalytics` fetches orders with no `.limit()`, but Supabase caps at 1000 rows by default. Your band has 1130+ orders, so analytics are computed on incomplete data (missing the oldest ~130 orders).

3. **No daily sales summary on inventory tab** — the main Merchandise page inventory view shows stock quantities but doesn't display "sold today" or "sold this week" per item. Players can't see that sales are happening without navigating to the Sales Analytics tab.

4. **$100M priced item skewing data** — one Digital Wallpaper Pack is priced at $100,000,000, which makes all revenue charts unreadable due to scale distortion.

### Plan

#### 1. Register `simulate-merch-sales` in config.toml
Add the function entry so it deploys correctly.

#### 2. Fix 1000-row query limit in `useMerchSalesAnalytics`
Add `.limit(5000)` to the orders query to fetch all relevant data. For "today" and "week" ranges the count will be well under this, and for "all time" it captures the full history.

#### 3. Add daily sales indicators to inventory items
In `src/pages/Merchandise.tsx`, fetch today's merch_orders grouped by merchandise_id and display a "Sold today: X" badge on each `MerchItemCard` in the inventory tab. This gives immediate feedback that the sales simulation is working.

#### 4. Version bump to v1.0.893

### Files to modify
- `supabase/config.toml` — add simulate-merch-sales entry
- `src/hooks/useMerchSalesAnalytics.ts` — add `.limit(5000)` to query
- `src/pages/Merchandise.tsx` — add daily sales query + display per item
- `src/components/VersionHeader.tsx` — bump version
- `src/pages/VersionHistory.tsx` — changelog

### Technical note on the $100M item
This is user-set pricing data. Will not auto-correct it, but worth noting it distorts charts significantly.

