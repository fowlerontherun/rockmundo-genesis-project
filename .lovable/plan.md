

## Release Manager Financial Breakdown Enhancements (v1.0.672)

### Overview
Add detailed financial breakdowns throughout the Release Manager showing manufacturing costs in dollars, per-song cost allocation, tax paid, distribution fees, and profit/loss calculations.

### Changes

#### 1. FormatSelectionStep.tsx -- Show Manufacturing Costs in Dollars During Creation
Currently costs display as `${(cost / 100).toFixed(2)}` (converting from cents). This is already showing dollars. We will enhance this step to also show:
- A per-song manufacturing cost estimate (total cost / number of songs, passed as a new prop)
- A cost summary card at the bottom with line-item breakdown per format

**Changes:**
- Add `songCount` prop to `FormatSelectionStep`
- In the total cost summary card, add a breakdown showing each selected format's cost as a line item
- Show per-song cost: "Cost per track: $X.XX" below the total

#### 2. CreateReleaseDialog.tsx -- Pass Song Count to Format Step
- Pass `songCount={selectedSongs.length}` to the `FormatSelectionStep` component

#### 3. ReleaseCard in MyReleasesTab.tsx -- Add Financial Breakdown Section
Replace the current simple "Production Cost" and "Revenue" boxes with a detailed financial breakdown section on each release card:
- **Manufacturing Cost**: Total production cost (already exists)
- **Gross Revenue**: Total revenue from sales
- **Tax Paid**: Sum of `sales_tax_amount` from `release_sales`
- **Distribution Fees**: Sum of `distribution_fee` from `release_sales`
- **Net Profit/Loss**: Revenue minus costs minus tax minus distribution

This requires fetching `release_sales` aggregated data. We will add a query for sales financial summary per release.

#### 4. ReleaseAnalyticsDialog.tsx -- Add Financial Tab
Add a new "Financials" tab to the analytics dialog with a full P&L breakdown:
- Manufacturing cost (from `releases.total_cost`)
- Gross revenue (streaming + physical/digital)
- Sales tax paid (aggregated from `release_sales.sales_tax_amount`)
- Distribution fees (aggregated from `release_sales.distribution_fee`)
- Net revenue (aggregated from `release_sales.net_revenue`)
- Profit = Net revenue - manufacturing cost
- Per-song breakdown showing which songs generated what revenue

#### 5. MyReleasesTab.tsx -- Enhance Stats Overview
Add two new stat cards to the top overview:
- **Total Tax Paid**: Aggregated across all releases
- **Total Profit**: Revenue minus costs minus tax minus distribution fees

### Technical Details

**Data sources:**
- `releases.total_cost` -- manufacturing cost (stored in cents)
- `release_sales.sales_tax_amount` -- per-sale tax (in cents)
- `release_sales.distribution_fee` -- per-sale distribution fee (in cents)
- `release_sales.net_revenue` -- per-sale net revenue after deductions (in cents)
- `release_sales.total_amount` -- gross sale amount (in cents)

Note: Current sample data shows zeros for tax/distribution/net_revenue, meaning the `generate-daily-sales` edge function may not be populating these yet. The UI will display them regardless so they show correctly once data flows in.

**Files to modify:**
1. `src/components/releases/FormatSelectionStep.tsx` -- Add songCount prop, per-song cost display, format line-item breakdown
2. `src/components/releases/CreateReleaseDialog.tsx` -- Pass songCount prop
3. `src/components/releases/MyReleasesTab.tsx` -- Fetch release_sales financial data, add breakdown to ReleaseCard, enhance stats overview
4. `src/components/releases/ReleaseAnalyticsDialog.tsx` -- Add Financials tab with full P&L
5. `src/components/VersionHeader.tsx` -- Bump to 1.0.672
6. `src/pages/VersionHistory.tsx` -- Add changelog entry

