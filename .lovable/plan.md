
# Record Sales Tuning & Fame Breakdown Implementation Plan

## Overview

This plan adds:
1. **Admin page for Sales Balance** - Configure physical and digital record sales multipliers with live tweaking
2. **Fame/Fans Breakdown** - Expandable regional breakdown on Dashboard and Band Manager pages showing fame and fans by country/city

---

## Part 1: Database Schema Updates

### Add Sales Balance Config to `game_balance_config`

Insert new configuration entries for the sales system:

| Category | Key | Value | Description | Min | Max | Unit |
|----------|-----|-------|-------------|-----|-----|------|
| sales | digital_base_sales_min | 5 | Minimum base digital sales per day | 0 | 50 | sales |
| sales | digital_base_sales_max | 25 | Maximum base digital sales per day | 10 | 100 | sales |
| sales | cd_base_sales_min | 2 | Minimum base CD sales per day | 0 | 20 | sales |
| sales | cd_base_sales_max | 10 | Maximum base CD sales per day | 5 | 50 | sales |
| sales | vinyl_base_sales_min | 1 | Minimum base vinyl sales per day | 0 | 10 | sales |
| sales | vinyl_base_sales_max | 6 | Maximum base vinyl sales per day | 2 | 25 | sales |
| sales | cassette_base_sales_min | 1 | Minimum base cassette sales per day | 0 | 5 | sales |
| sales | cassette_base_sales_max | 4 | Maximum base cassette sales per day | 1 | 15 | sales |
| sales | fame_multiplier_divisor | 10000 | Fame value to divide by for multiplier | 1000 | 100000 | fame |
| sales | regional_fame_weight | 1.0 | Weight of regional fame on sales | 0.1 | 3.0 | x |
| sales | market_scarcity_min_bands | 20 | Bands threshold for max scarcity bonus | 5 | 100 | bands |
| sales | market_scarcity_max_multiplier | 5 | Maximum market scarcity multiplier | 1 | 10 | x |
| sales | performed_country_bonus | 1.2 | Bonus multiplier for performed countries | 1.0 | 2.0 | x |
| sales | unvisited_fame_cap | 100 | Fame cap for unvisited countries | 50 | 500 | fame |
| sales | spillover_rate | 0.2 | Fame spillover rate to neighbors | 0.0 | 0.5 | % |

---

## Part 2: Admin Sales Balance Page

### New File: `src/pages/admin/SalesBalanceAdmin.tsx`

A dedicated admin page for tuning record sales parameters:

**Features:**
- **Base Sales Section**: Sliders for digital, CD, vinyl, cassette min/max base sales
- **Multiplier Section**: Fame divisor, regional weight, market scarcity settings
- **Regional Fame Section**: Performed country bonus, unvisited cap, spillover rate
- **Live Preview**: Show calculated example sales based on sample fame values
- **Save All**: Batch save all changes to `game_balance_config`

**UI Layout:**
```text
+------------------------------------------+
| Sales Balance Admin                       |
| Configure physical & digital sales        |
+------------------------------------------+
| [Base Sales] [Multipliers] [Regional]     |
+------------------------------------------+
| Digital Sales                             |
| Min: [====5====] Max: [====25====]        |
|                                           |
| CD Sales                                  |
| Min: [====2====] Max: [====10====]        |
|                                           |
| Vinyl Sales                               |
| Min: [====1====] Max: [====6=====]        |
+------------------------------------------+
| Preview: Band with 50K fame, 10K regional |
| Estimated daily: Digital 45, CD 18, Vinyl 9|
+------------------------------------------+
```

### Add Route to `src/App.tsx`
```typescript
const AdminSalesBalance = lazyWithRetry(() => import("./pages/admin/SalesBalanceAdmin"));
// Route: path="admin/sales-balance" element={<AdminSalesBalance />}
```

### Add to Admin Navigation
Update `src/components/admin/AdminNav.tsx` to include in "Economy & Resources" category:
```typescript
{ path: "/admin/sales-balance", label: "Sales Balance", description: "Record sales tuning" }
```

### Add to Admin Dashboard Quick Actions
Update `src/pages/admin/AdminDashboard.tsx`:
```typescript
{ label: "Sales Balance", path: "/admin/sales-balance", icon: DollarSign }
```

---

## Part 3: Fame/Fans Regional Breakdown Component

### New Component: `src/components/fame/RegionalFameBreakdown.tsx`

A compact, expandable component showing fame and fans by country and city:

**Features:**
- Collapsible accordion layout
- Summary stats at top (countries count, top country)
- Country list with fame bars and fan counts
- Expandable cities within each country
- Flag emoji for countries
- Progress bars for relative fame comparison

**UI Layout (Collapsed):**
```text
+------------------------------------------+
| Regional Fame                     [v]     |
| 12 countries • Top: United States 50K    |
+------------------------------------------+
```

**UI Layout (Expanded):**
```text
+------------------------------------------+
| Regional Fame                     [^]     |
+------------------------------------------+
| United States                            |
| Fame: 50,000  |=================| 100%   |
| Fans: 125K casual, 45K dedicated, 8K super|
| [v] 8 cities                              |
+------------------------------------------+
| United Kingdom                           |
| Fame: 32,000  |===========|      64%     |
| Fans: 78K casual, 28K dedicated, 5K super |
| [v] 5 cities                              |
+------------------------------------------+
| Germany                                   |
| Fame: 18,500  |======|           37%     |
| [+] Never performed (capped at 100)       |
+------------------------------------------+
```

### Integration Points

**1. Dashboard Fame Tab (`src/components/fame/CharacterFameOverview.tsx`):**
- Add `RegionalFameBreakdown` component after the band section
- Pass band_id from band membership query

**2. Band Manager Fame Section (`src/components/fame/FameFansOverview.tsx`):**
- Already has country/city tabs - enhance with expandable city details inside country rows
- Add "has_performed" indicator with visual distinction

**3. SimpleBandManager (`src/pages/SimpleBandManager.tsx`):**
- Add a collapsible fame breakdown card in the Performance tab

---

## Part 4: Update Edge Function to Use Config

### Modify: `supabase/functions/generate-daily-sales/index.ts`

Add config fetching from `game_balance_config`:

```typescript
// Fetch sales config at start
const { data: salesConfig } = await supabaseClient
  .from("game_balance_config")
  .select("key, value")
  .eq("category", "sales");

const config = Object.fromEntries(
  (salesConfig || []).map(c => [c.key, c.value])
);

// Use config values with fallbacks
const digitalMin = config.digital_base_sales_min ?? 5;
const digitalMax = config.digital_base_sales_max ?? 25;
const fameDivisor = config.fame_multiplier_divisor ?? 10000;
// etc...

// Replace hardcoded values
switch (format.format_type) {
  case "digital":
    baseSales = digitalMin + Math.floor(Math.random() * (digitalMax - digitalMin));
    break;
  // ... other formats
}
```

---

## Part 5: File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/pages/admin/SalesBalanceAdmin.tsx` | Admin page for sales tuning |
| `src/components/fame/RegionalFameBreakdown.tsx` | Expandable fame breakdown component |

### Modified Files
| File | Changes |
|------|---------|
| `src/App.tsx` | Add route for SalesBalanceAdmin |
| `src/components/admin/AdminNav.tsx` | Add Sales Balance to Economy category |
| `src/pages/admin/AdminDashboard.tsx` | Add Sales Balance quick action |
| `src/components/fame/CharacterFameOverview.tsx` | Add regional breakdown for bands |
| `src/components/fame/FameFansOverview.tsx` | Add has_performed indicator, enhance city view |
| `src/pages/SimpleBandManager.tsx` | Add collapsible fame breakdown |
| `supabase/functions/generate-daily-sales/index.ts` | Read config from database |
| `src/components/VersionHeader.tsx` | Bump to v1.0.539 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

### Database Migration
Insert 15 new rows into `game_balance_config` for sales category.

---

## Part 6: Technical Details

### Sales Config Interface
```typescript
interface SalesConfig {
  digital_base_sales_min: number;
  digital_base_sales_max: number;
  cd_base_sales_min: number;
  cd_base_sales_max: number;
  vinyl_base_sales_min: number;
  vinyl_base_sales_max: number;
  cassette_base_sales_min: number;
  cassette_base_sales_max: number;
  fame_multiplier_divisor: number;
  regional_fame_weight: number;
  market_scarcity_min_bands: number;
  market_scarcity_max_multiplier: number;
  performed_country_bonus: number;
  unvisited_fame_cap: number;
  spillover_rate: number;
}
```

### Regional Fame Breakdown Props
```typescript
interface RegionalFameBreakdownProps {
  bandId: string;
  compact?: boolean; // For dashboard vs full page view
  defaultExpanded?: boolean;
}
```

### Country Flag Helper
Use existing `getCountryFlag` function from `FameFansOverview.tsx` - can be extracted to shared util.

---

## Part 7: Preview Calculation (Admin Page)

The admin page will show a live preview of expected sales:

```typescript
const calculatePreviewSales = (config: SalesConfig, sampleFame: number, sampleRegionalFame: number) => {
  const fameMultiplier = 1 + sampleFame / config.fame_multiplier_divisor;
  const regionalMultiplier = 0.5 + (sampleRegionalFame / 10000) * 1.5;
  
  return {
    digital: Math.round((config.digital_base_sales_min + config.digital_base_sales_max) / 2 * fameMultiplier * regionalMultiplier),
    cd: Math.round((config.cd_base_sales_min + config.cd_base_sales_max) / 2 * fameMultiplier * regionalMultiplier),
    vinyl: Math.round((config.vinyl_base_sales_min + config.vinyl_base_sales_max) / 2 * fameMultiplier * regionalMultiplier),
  };
};
```

---

## Version Update

- Version: **1.0.539**
- Changes:
  - Admin: New Sales Balance page to tune physical/digital record sales parameters
  - Admin: Configure base sales ranges, fame multipliers, regional weights, and market scarcity
  - Dashboard: Regional fame breakdown showing fame and fans by country with expandable cities
  - Band Manager: Enhanced fame view with has_performed indicators and city details
  - Sales System: Edge function now reads config from database for adjustable parameters
