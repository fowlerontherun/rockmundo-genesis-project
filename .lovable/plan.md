
# Record Sales Tax & Distribution Costs Implementation
**Version: 1.0.570**

## Overview
This update addresses the over-profitability of record sales by introducing realistic tax and distribution deductions. Bands will now receive net profit after:
1. **City Sales Tax** - Based on the band's home city's mayor-set rate (default 10%)
2. **Distribution Costs** - Platform/distributor fees that vary by format type

---

## How It Will Work

### Tax Calculation
- When a sale is generated, the system looks up the **band's home city**
- If the city has active laws set by a mayor, use that city's `sales_tax_rate`
- If no mayor or no city laws exist, **default to 10% tax**
- Tax is deducted from the sale before crediting the band

### Distribution Costs
- Each format type has a distribution fee percentage:
  - **Digital**: 30% (platform takes 30%, like typical digital stores)
  - **CD**: 20% (physical distributor cut)
  - **Vinyl**: 15% (specialty distributor, lower volume = lower cut)
  - **Cassette**: 15% (similar to vinyl)

### Example Calculation
```
Sale: 10 CDs at $14.99 each = $149.90 gross
City Sales Tax (8%): -$11.99
Distribution Fee (20%): -$29.98
Net to Band: $107.93
```

---

## Database Changes

### 1. Add Columns to `release_sales` Table
| Column | Type | Description |
|--------|------|-------------|
| `sales_tax_amount` | integer | Tax collected (in cents) |
| `sales_tax_rate` | numeric | Tax rate applied (%) |
| `distribution_fee` | integer | Distributor cut (in cents) |
| `distribution_rate` | numeric | Distribution % applied |
| `net_revenue` | integer | Amount after deductions (in cents) |
| `city_id` | uuid | Reference to city where tax applied |

### 2. Add Distribution Config to `game_balance_config`
New configurable parameters (in `sales` category):
- `digital_distribution_rate`: 30%
- `cd_distribution_rate`: 20%
- `vinyl_distribution_rate`: 15%
- `cassette_distribution_rate`: 15%
- `default_sales_tax_rate`: 10%

---

## Edge Function Updates

### `generate-daily-sales/index.ts`
1. Fetch band's `home_city_id` along with existing band data
2. Look up `city_laws` for that city to get `sales_tax_rate`
3. Fall back to default 10% if no laws exist
4. Calculate distribution fee based on format type
5. Store gross, tax, distribution, and net amounts
6. Credit **net revenue** (not gross) to `band_earnings`

---

## Admin UI Enhancements

### Update `SalesBalanceAdmin.tsx`
Add new tab "Costs" with sliders for:
- Default sales tax rate (when no city laws)
- Distribution rates per format type

Add to the live preview calculation to show:
- Gross revenue
- Tax deduction
- Distribution cost
- Net profit

---

## Frontend Display Updates

### Release Detail Page
Update the revenue display to show:
- Gross sales
- Tax paid
- Distribution fees
- Net revenue

This gives players transparency into where their money goes.

---

## Technical Implementation Summary

| File | Change Type |
|------|-------------|
| `supabase/migrations/[new].sql` | Add columns to `release_sales`, insert default distribution configs |
| `supabase/functions/generate-daily-sales/index.ts` | Implement tax + distribution logic |
| `src/integrations/supabase/types.ts` | Auto-regenerated with new columns |
| `src/pages/admin/SalesBalanceAdmin.tsx` | Add distribution/tax config UI |
| `src/pages/ReleaseDetail.tsx` | Show tax/distribution breakdown |
| `src/components/VersionHeader.tsx` | Bump to 1.0.570 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details

### Edge Function Logic (Pseudocode)
```typescript
// For each release sale:
const band = release.bands[0];
const homeCityId = band?.home_city_id;

// Get city sales tax rate
let salesTaxRate = 0.10; // Default 10%
if (homeCityId) {
  const cityLaws = await getCityLaws(homeCityId);
  if (cityLaws?.sales_tax_rate) {
    salesTaxRate = cityLaws.sales_tax_rate / 100;
  }
}

// Get distribution rate from config
const distributionRate = config[`${format.format_type}_distribution_rate`] ?? 0.25;

// Calculate deductions
const grossRevenue = actualSales * retailPrice;
const salesTax = Math.round(grossRevenue * salesTaxRate * 100) / 100;
const distributionFee = Math.round(grossRevenue * distributionRate * 100) / 100;
const netRevenue = grossRevenue - salesTax - distributionFee;

// Record sale with full breakdown
await supabase.from("release_sales").insert({
  // ... existing fields
  sales_tax_amount: Math.round(salesTax * 100),
  sales_tax_rate: salesTaxRate * 100,
  distribution_fee: Math.round(distributionFee * 100),
  distribution_rate: distributionRate * 100,
  net_revenue: Math.round(netRevenue * 100),
  city_id: homeCityId,
});

// Credit NET revenue to band (not gross)
await supabase.from("band_earnings").insert({
  band_id: band.id,
  amount: netRevenue, // Changed from grossRevenue
  source: "release_sales",
  description: `Daily sales revenue (after ${(salesTaxRate * 100).toFixed(0)}% tax + ${(distributionRate * 100).toFixed(0)}% distribution)`,
  metadata: { 
    format: format.format_type, 
    units: actualSales,
    gross_revenue: grossRevenue,
    sales_tax: salesTax,
    distribution_fee: distributionFee,
    net_revenue: netRevenue,
  },
});
```

---

## Impact Analysis

### Before (Current)
- Band sells 100 digital albums at $9.99 = **$999 profit**

### After (With Changes)
- Gross: $999
- Sales Tax (10%): -$99.90
- Distribution (30%): -$299.70
- **Net Profit: $599.40**

This reduces record sale profits by approximately **40%** with default settings, making them more balanced with other income sources.
