

## Fix Label Revenue Visibility & Add Per-Artist Financial Breakdown

### Problem
The label revenue splitting logic already works correctly in both `generate-daily-sales` and `update-daily-streams` — labels receive their cut of sales and streaming revenue, and it's credited to the label balance. However, the **Finance tab queries the wrong table**. Revenue is logged to `label_financial_transactions`, but the UI reads from `label_transactions` (which only tracks deposits/withdrawals). This makes it appear as though labels aren't earning anything.

Additionally, there's no per-artist breakdown showing how much each signed artist is generating for the label.

### Build Error
The `npm:openai` error comes from Supabase's edge-runtime type definitions, not our code. Will suppress with a tsconfig adjustment or ignore — this is a known Supabase SDK issue.

---

### Plan

#### 1. Fix Finance Tab to show revenue transactions
**File: `src/components/labels/management/LabelFinanceTab.tsx`**
- Add a second query fetching from `label_financial_transactions` (where daily sales/streaming revenue is recorded)
- Merge both transaction sources into a unified timeline
- Show revenue entries (green) alongside deposit/withdrawal entries
- Add summary cards: Total Revenue from Artists, Total Marketing Spend, Net P&L

#### 2. Add Per-Artist Revenue Breakdown
**File: `src/components/labels/management/LabelFinanceTab.tsx`** (new section in the overview)
- Query `label_financial_transactions` joined with `artist_label_contracts` to get per-contract revenue
- Join contracts to bands to get artist names
- Display a table: Artist Name | Total Revenue | Recouped | Outstanding Advance | Contract Split
- Show both sales and streaming revenue breakdowns per artist

#### 3. Fix build error
**File: `supabase/functions/admin-boost-plays/index.ts`** or config
- The openai import error is from `@supabase/functions-js` edge-runtime types, not our code. Will check if a deno.json or import_map needs updating, or if we just need to ensure the build doesn't type-check edge functions against that module.

### Technical Details
- `label_financial_transactions` has columns: `label_id`, `transaction_type`, `amount`, `description`, `related_contract_id`, `related_release_id`, `related_band_id`, `created_at`
- `label_transactions` has: `label_id`, `transaction_type`, `amount`, `description`, `initiated_by`, `created_at`
- Revenue entries use `related_contract_id` which links to `artist_label_contracts` → `band_id` → `bands.name`
- Both `generate-daily-sales` and `update-daily-streams` correctly insert to `label_financial_transactions` with `transaction_type: "revenue"`

### Files to edit
- `src/components/labels/management/LabelFinanceTab.tsx` — merge both transaction tables, add per-artist breakdown
- Edge function config/build fix for the openai type error

