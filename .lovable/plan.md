
## v1.0.708 — Fix Record Sales Revenue Display and Band Debt Relief

### Problem Summary

**1. Revenue figures are displayed 100x too high (cents shown as dollars)**
All `release_sales` financial columns (`total_amount`, `net_revenue`, `sales_tax_amount`, `distribution_fee`) are stored in **cents** in the database. However, the UI displays these raw cent values as if they were dollars. For example, a $8,041.95 gross revenue shows as "$804,195".

This affects:
- **ReleaseSalesTab.tsx**: Total revenue and per-sale amounts displayed in cents
- **ReleaseAnalyticsDialog.tsx**: Revenue breakdown, P&L statement, and per-song financials all in cents
- The `release.total_revenue` field (stored in dollars by `increment_release_revenue`) is mixed with `release_sales.total_amount` (stored in cents), creating inconsistency

**2. Bands are deep in debt**
- "Big Fowler and the Growlers": **-$39.9M** (caused by $41M in leader withdrawals)
- "Mr. Blue": **-$915K**
- "Jophiel": **-$59K**

---

### Fix 1: Convert cents to dollars in all display components

**File: `src/components/releases/ReleaseSalesTab.tsx`**
- Line 57: Divide `totalRevenue` by 100 when summing `sale.total_amount`
- Line 237: Divide `sale.total_amount` by 100 for individual sale display

**File: `src/components/releases/ReleaseAnalyticsDialog.tsx`**
- Lines 117-127 (sales aggregation): Divide `total_amount` by 100
- Lines 154-160 (financial summary): Divide all cent fields (`total_amount`, `sales_tax_amount`, `distribution_fee`, `net_revenue`) by 100
- All corresponding display lines in the Financials tab

### Fix 2: Reset band balances to zero for bands in debt

**Database migration:**
```sql
UPDATE bands 
SET band_balance = 0 
WHERE band_balance < 0;
```

This resets the 3 affected bands to a clean slate.

### Fix 3: Version bump

- Update version to **v1.0.708** in `navigation.tsx`
- Add changelog entry in `VersionHistory.tsx`

---

### Technical Details

The root cause of the display bug is a unit mismatch. The `generate-daily-sales` edge function correctly stores values in cents:
```
unit_price: 999         (cents, = $9.99)
total_amount: 804195    (cents, = $8,041.95)
net_revenue: 562936     (cents, = $5,629.36)
```

But the UI reads these values directly without dividing by 100:
```typescript
// BUG: total_amount is in cents, displayed as dollars
const totalRevenue = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
// Shows "$804,195" instead of "$8,041.95"
```

### Files to Change

| File | Change |
|------|--------|
| `src/components/releases/ReleaseSalesTab.tsx` | Divide cent values by 100 for display |
| `src/components/releases/ReleaseAnalyticsDialog.tsx` | Divide all cent-based financial fields by 100 |
| New SQL migration | Reset negative band balances to 0 |
| `src/components/ui/navigation.tsx` | Version bump to v1.0.708 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |
