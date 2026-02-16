

## v1.0.712 — Fix Record Sales Finances

Three bugs are causing the financial confusion in band manager and release views.

---

### Bug 1: Tax and Fees Displayed 100x Too High

**Problem**: In the My Releases tab, tax paid and distribution fees are pulled from `release_sales` (stored in **cents**) but displayed as if they were dollars. Meanwhile, Total Revenue comes from `releases.total_revenue` (stored in **dollars**). This means:
- A release earning $1,000 gross shows "Tax Paid: $20,000" (actually 20000 cents = $200)
- Net Profit then goes massively negative because you're subtracting cents from dollars

**Fix**: In `MyReleasesTab.tsx` lines 157-160, divide all `release_sales` aggregated values by 100 to convert cents to dollars, matching how `ReleaseAnalyticsDialog.tsx` already does it correctly.

### Bug 2: Daily Sales Never Credit Band Balance

**Problem**: The `generate-daily-sales` edge function inserts a `band_earnings` record with the net revenue, but **never updates `bands.band_balance`**. Every other revenue source (gigs, sponsorships, PR, videos, merch, major events) explicitly updates `band_balance`. Record sales are the only source that skips this step, so bands never receive spendable cash from their sales.

**Fix**: Add a `band_balance` update in `generate-daily-sales` after the `band_earnings` insert, matching the pattern used in `complete-gig`, `simulate-video-views`, etc.

### Bug 3: Confusing Display in Band Finances Tab

**Problem**: The band finances tab only shows the last 20 transactions with generic labels. When a band has hundreds of small daily sales entries, the "average deposit" and "monthly runway" metrics become misleading.

**Fix**: Add better source labels for `release_sales`, `video_revenue`, and other newer sources to the `sourceLabels` map in `BandFinancesTab.tsx` so entries display clearly.

---

### Technical Changes

#### File: `src/components/releases/MyReleasesTab.tsx`
- Lines 157-160: Divide `total_amount`, `sales_tax_amount`, `distribution_fee`, and `net_revenue` by 100 when aggregating from `release_sales`

#### File: `supabase/functions/generate-daily-sales/index.ts`
- After the `band_earnings` insert (line 326-343), add a `bands` table update to increment `band_balance` by `netRevenue`, matching the pattern:
```
const { data: band } = await supabaseClient
  .from('bands')
  .select('band_balance')
  .eq('id', release.band_id)
  .single();

await supabaseClient
  .from('bands')
  .update({ band_balance: (band.band_balance || 0) + netRevenue })
  .eq('id', release.band_id);
```

#### File: `src/components/bands/BandFinancesTab.tsx`
- Expand `sourceLabels` to include: `release_sales`, `video_revenue`, `sponsorship`, `pr_appearance`, `refund`, `leader_deposit`, `leader_withdrawal`, `recording`, `major_event`

#### File: `src/components/VersionHeader.tsx`
- Version bump to 1.0.712

#### File: `src/components/ui/navigation.tsx`
- Version bump to 1.0.712

#### File: `src/pages/VersionHistory.tsx`
- Add changelog entry for v1.0.712

---

### Impact

- Tax/fees will display at correct dollar amounts (100x smaller than currently shown)
- Profit calculations will be accurate (revenue, tax, and fees all in same unit)
- Bands will actually receive spendable cash from record sales going forward
- Transaction history will have clearer labels

