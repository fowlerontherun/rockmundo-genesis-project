

# Merchandise System Overhaul (v1.0.799)

## Overview
A major expansion of the merchandise system adding AI-generated product images, realistic business costs (ordering, storage, logistics, taxes), a VIP-only Merchandise Manager hire, and new merch-themed random events that tie into the narrative system.

---

## Part 1: AI-Generated Merchandise Images

### What it does
When a player creates a new merch item (e.g. "Summer Tour 2024 Tee"), an AI image is generated showing that product with the band's aesthetic. Images appear on product cards, in the catalog, and on the overview table.

### Implementation
- **New edge function**: `generate-merch-image` -- follows the same pattern as `generate-housing-image` and `generate-dikcok-thumbnail`
- Uses `google/gemini-2.5-flash-image` via the Lovable AI gateway
- Prompt incorporates: item type (tee, hoodie, poster, vinyl, etc.), design name, band name, quality tier
- Generated image uploaded to Supabase Storage bucket `merch-images`
- URL saved to the existing `design_preview_url` column on `player_merchandise`
- **Batch generation**: "Generate All Missing Images" button on the overview tab
- **Single generation**: Auto-triggered when adding a new product, or manual "Generate Image" button on each product card

### UI changes
- Product cards in overview table and catalog show the AI image thumbnail
- MerchItemCard gets a small image preview area
- "Regenerate Image" button on Manage Inventory tab (costs $100 in-game cash)

---

## Part 2: Realistic Business Costs

### New cost categories added to merchandise management

| Cost Type | How it works |
|-----------|-------------|
| **Order Cost** | When adding stock, player pays `quantity x cost_to_produce` upfront from band cash |
| **Storage Fee** | Daily cost of $0.10 per unit in stock (displayed as monthly estimate) |
| **Logistics Fee** | 5% of sale price applied to each sale (shipping/handling) |
| **Tax Rate** | 8% tax on revenue (shown separately in analytics) |

### Database changes
- Add columns to `player_merchandise`: `storage_cost_daily` (integer, default 10 cents per unit), `logistics_pct` (numeric, default 0.05), `tax_pct` (numeric, default 0.08)
- Ordering stock now deducts `quantity x cost_to_produce` from band cash (or player cash)
- Sales analytics updated to show gross revenue, logistics costs, taxes, storage costs, and net profit

### UI changes
- **Add Product tab**: Shows total order cost before confirming ("Order 50 units = $350 production cost")
- **Overview tab**: New "Operating Costs" summary card showing daily storage, estimated monthly logistics, tax liability
- **Manage Inventory tab**: Restock button shows cost to order more units
- **Sales tab**: Profit breakdown: Gross Revenue - Production - Logistics - Tax - Storage = Net Profit

---

## Part 3: VIP Merchandise Manager

### What it does
VIP players can hire a "Merch Manager" NPC who automates restocking, suggests pricing, and reduces logistics costs.

### Features
- **Auto-restock**: When stock drops below a threshold, the manager orders more (up to a configurable limit)
- **Price optimization**: Suggests optimal prices based on quality tier and band fame
- **Logistics discount**: Reduces logistics fee from 5% to 3%
- **Monthly salary**: $2,000/month deducted from band cash
- **Hire/Fire UI**: Card on the overview tab (VIP-gated) with manager status, salary info, and toggle

### Database changes
- Add columns to `player_merchandise` table or a new `merch_managers` table:
  - `merch_managers`: `id`, `band_id`, `manager_name` (randomly generated), `monthly_salary` (default 2000), `is_active`, `auto_restock_enabled`, `restock_threshold` (default 10), `restock_quantity` (default 50), `hired_at`, `created_at`

### UI changes
- New "Manager" section on the overview tab, wrapped in `VipGate`
- Shows manager name, monthly cost, auto-restock settings
- Toggle switches for auto-restock, with configurable threshold and quantity
- "Fire Manager" button with confirmation dialog

---

## Part 4: Random Events Integration

### New merch-themed random events (added to `random_events` table)

| Event | Category | Option A | Option B |
|-------|----------|----------|----------|
| **Bootleg Alert** | merchandise | Sue the bootlegger (-$500, +fame) | Ignore it (-stock on best seller) |
| **Viral Merch Moment** | merchandise | Capitalize with flash sale (+sales, -stock) | Play it cool (+fame, smaller boost) |
| **Factory Delay** | merchandise | Pay rush fee (-$1000, stock arrives) | Wait it out (no stock for 3 days) |
| **Fan Design Contest** | merchandise | Accept winning design (+unique item, +fans) | Decline (no effect) |
| **Warehouse Fire** | merchandise | Pay insurance excess (-$2000, partial recovery) | Lose all stock of random item |
| **Celebrity Spotted in Your Merch** | merchandise | Post about it (+fame, +merch sales) | Stay quiet (+credibility) |
| **Tax Audit** | financial | Pay accountant (-$800, clean) | Handle yourself (50% chance of fine) |
| **Merch Manager Scandal** (VIP only) | merchandise | Fire and rehire (-$500) | Cover it up (-fame, keep manager) |

### Implementation
- Insert these events via migration SQL into `random_events` with `category: 'merchandise'`
- Effects use existing JSONB `option_a_effects` / `option_b_effects` format (cash, fame, fans, stock changes)
- These events can trigger naturally through the existing random event system

---

## Part 5: Expansion Suggestions (Future Roadmap)

These are ideas for further depth -- not implemented in this version but designed to slot in later:

1. **Limited Edition Drops**: Time-limited merch with countdown timers and scarcity mechanics (columns already exist: `is_limited_edition`, `limited_quantity`, `available_until`)
2. **Tour-Exclusive Merch**: Items only available during specific tours (column exists: `tour_exclusive_tour_id`)
3. **Merch Bundles**: Combine items into discounted bundles for higher average order value
4. **Fan Demand System**: AI-driven demand curves where popularity of item types shifts based on genre trends, season, and band fame
5. **Merch Collaborations with Other Bands**: Cross-promote with other player bands for shared merch lines (collaboration system already partially built)
6. **Pop-Up Shop Events**: Temporary merch stands in specific cities during tours with location-based bonuses
7. **Merch Quality Degradation**: Over time, unsold stock degrades in quality tier, forcing clearance sales
8. **Counterfeit Market**: Random events where bootleg versions of your merch appear, affecting your sales unless you take legal action

---

## Technical Details

### Files to create
- `supabase/functions/generate-merch-image/index.ts` -- AI image generation edge function
- `supabase/migrations/xxx_merch_overhaul.sql` -- new columns, merch_managers table, random events insert

### Files to modify
- `src/pages/Merchandise.tsx` -- add cost displays, manager section, image previews, operating costs card
- `src/hooks/useMerchSales.ts` -- add logistics/tax/storage cost calculations to analytics
- `src/components/merchandise/MerchCatalog.tsx` -- show order cost, trigger image generation on add
- `src/components/merchandise/MerchItemCard.tsx` -- display AI image thumbnail
- `src/components/merchandise/SalesAnalyticsTab.tsx` -- profit breakdown with new cost categories
- `src/components/VersionHeader.tsx` -- bump to 1.0.799
- `src/pages/VersionHistory.tsx` -- changelog entry

### New merch_managers table
```sql
CREATE TABLE merch_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES bands(id) NOT NULL,
  manager_name text NOT NULL,
  monthly_salary integer NOT NULL DEFAULT 2000,
  is_active boolean NOT NULL DEFAULT true,
  auto_restock_enabled boolean NOT NULL DEFAULT true,
  restock_threshold integer NOT NULL DEFAULT 10,
  restock_quantity integer NOT NULL DEFAULT 50,
  logistics_discount numeric NOT NULL DEFAULT 0.02,
  hired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(band_id)
);
ALTER TABLE merch_managers ENABLE ROW LEVEL SECURITY;
```

### Edge function pattern (generate-merch-image)
```typescript
// Same pattern as generate-housing-image
// Prompt: "Generate a product photo of a {item_type} with design '{design_name}' 
//          for the band '{band_name}'. Style: {quality_tier} quality merchandise.
//          Clean product photography on white background."
// Model: google/gemini-2.5-flash-image
// Upload to: merch-images/{band_id}/{merch_id}.png
// Save URL to: player_merchandise.design_preview_url
```

### Cost formulas
```typescript
const orderCost = quantity * costToProduce;           // Upfront
const dailyStorageCost = stockQuantity * 0.10;        // Per day
const logisticsFee = salePrice * 0.05;                // Per sale
const taxAmount = salePrice * 0.08;                   // Per sale
const netProfit = salePrice - costToProduce - logisticsFee - taxAmount;

// With manager discount:
const logisticsFeeWithManager = salePrice * 0.03;     // 3% instead of 5%
```

