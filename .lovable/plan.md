

# Review & Expand All Company Types + Deep Label Integration

## Current State Assessment

### Company Types (8 total) — Status

| Type | UI Management | Revenue Logic | Integration with Game |
|------|------|------|------|
| **Holding** | Create/view subsidiaries, finance dialog, tax overview | None (parent only) | Links to subsidiaries |
| **Record Label** | Full management page (contracts, releases, royalties, staff) | Random daily revenue in `process-company-operations` | **BROKEN**: Contracts have no effect on actual releases or revenue splits |
| **Security Firm** | Card, guards, contracts, upgrades | Random $200-800/day | Not connected to gig security |
| **Merch Factory** | Card, workers, production queue, upgrades, catalog | Random $500-2000/day | Not connected to band merch sales |
| **Logistics** | Card, fleet, drivers, contracts, upgrades | Random $300-1200/day | Not connected to tour transport |
| **Venue** | Bookings, staff, upgrades | Random $400-3000/day + gig revenue processing | Partially connected via `process-venue-bookings` |
| **Rehearsal Studio** | Card, equipment, staff, upgrades | Random $100-600/day | Partially connected via `process-studio-bookings` |
| **Recording Studio** | Card, equipment, staff, upgrades | Random $300-1500/day | Partially connected via `process-studio-bookings` |

### Critical Issues Found

1. **Label contracts are cosmetic**: The `releases` table has `label_contract_id` and `label_revenue_share_pct` columns but `generate-daily-sales` and `update-daily-streams` completely ignore them — 100% of revenue goes to the band regardless of contracts.

2. **No advance recoupment**: Contracts track `advance_amount` and `recouped_amount` but nothing ever increments `recouped_amount`. Labels pay advances but never recoup.

3. **`CreateReleaseDialog` ignores contracts**: When creating a release, the system never checks for an active label contract, never sets `label_contract_id`, never applies `manufacturing_covered` or `marketing_support` benefits.

4. **Subsidiary revenue is fake**: Security, Factory, Logistics all generate random daily revenue unconnected to actual game activity. Only Venues and Studios have partial real integration.

5. **No label-side release flow**: Label owners can't see or manage their signed artists' releases. The `label_releases` table exists as a parallel system but isn't connected to the main `releases` table.

6. **Company synergies exist in UI** but are display-only — no actual discount logic applied during transactions.

---

## Implementation Plan

### Phase 1: Make Label Contracts Actually Work (highest priority)

**A. Release creation respects active contracts**
- `CreateReleaseDialog.tsx`: Query for active `artist_label_contracts` for the band/artist
- If contract exists, auto-populate `label_contract_id` and `label_revenue_share_pct` on the release
- Apply contract benefits: if `manufacturing_covered = true`, label pays manufacturing cost (deduct from label balance instead of band)
- Apply `marketing_support` as starting hype bonus
- Show contract info in the release creation UI ("Released under [Label Name] — they cover manufacturing and take X% royalty")

**B. Revenue split in `generate-daily-sales`**
- Fetch `label_contract_id` and `label_revenue_share_pct` alongside each release
- When a release has a contract, split net revenue: `label_revenue_share_pct`% to label, remainder to band
- Credit label balance via `label_financial_transactions` table
- Increment `recouped_amount` on the contract until advance is recouped — until recouped, label takes 100% of their share

**C. Revenue split in `update-daily-streams`**
- Same logic: look up the release's contract via `release_songs → releases.label_contract_id`
- Split streaming revenue between band and label per contract terms

**D. Label owner dashboard — artist releases visibility**
- New section in MyLabelsTab or label detail: show all releases with `label_contract_id` pointing to contracts under this label
- Show revenue generated, recoupment progress, release count vs quota

### Phase 2: Connect Subsidiaries to Real Game Activity

**A. Security Firms → Gig Integration**
- When booking a gig, if band's company empire owns a security firm: apply discount (synergy) and log revenue to the security firm's company
- When using external security: external cost → could be redirected to a player-owned security firm if they accept the contract
- Replace random revenue with actual gig-security billing

**B. Merch Factory → Band Merch Integration**
- When manufacturing merch items: if band's company empire owns a factory, use it (reduced cost, factory earns revenue)
- Replace random factory revenue with actual merch manufacturing orders
- Link `simulate-merch-sales` to factory capacity/quality

**C. Logistics → Tour/Release Distribution**
- Tour transport costs: if empire owns logistics company, apply discount and credit the logistics company
- Release territory distribution: if empire owns logistics, reduce distribution cost multiplier
- Replace random logistics revenue with real transport bookings

**D. Recording Studio → Recording Sessions**
- When starting recording sessions: if empire owns a studio, use it (discount + studio earns revenue)
- Already partially implemented in `process-studio-bookings` — extend to check ownership chain

**E. Rehearsal Studio → Rehearsals**
- Same pattern: empire-owned rehearsal rooms give discounts, generate real revenue
- Already partially implemented — extend ownership chain check

### Phase 3: Expand Label Features

**A. Label owner tools**
- **Artist roster overview**: See all signed artists, contract status, release progress, recoupment status
- **Label-initiated releases**: Label owner can create releases for their signed artists (label pays costs)
- **Drop artists**: Terminate contracts from label side with financial consequences
- **Label A&R scouting improvements**: Staff A&R skill affects demo acceptance quality and scouting frequency

**B. Signed artist experience**
- **Contract benefits display**: Show on release creation what the label covers
- **Recoupment tracker**: Artists see how much of their advance has been recouped
- **Label relationship**: Trust/satisfaction score affecting future offers
- **Request release**: Artists can request to release from their contract (with fee)

**C. Deal type effects**
- **360 Deal**: Label takes cut of merch, tour, streaming, AND direct sales. Higher advance, lower artist cut.
- **Distribution Deal**: Label only distributes — takes small cut of sales only. No advance typically.
- **Production Deal**: Label covers recording costs. Takes moderate cut.
- **Licensing Deal**: Time-limited. Masters revert to artist after contract ends.
- **Standard Deal**: Label owns masters. Medium advance and royalty split.

Each deal type applies different `label_revenue_share_pct` logic and different expense coverage.

### Phase 4: Financial Reconciliation & Reporting

- **Label P&L statement**: Revenue from signed artists vs operating costs, staff salaries, advances paid
- **Company empire dashboard**: Aggregate view of all subsidiary revenue/costs
- **Monthly reports edge function**: Auto-generate financial summaries for companies

---

## Files to Modify

### Edge Functions (deploy)
- `supabase/functions/generate-daily-sales/index.ts` — add label revenue split + recoupment
- `supabase/functions/update-daily-streams/index.ts` — add label revenue split
- `supabase/functions/process-company-operations/index.ts` — replace random revenue with real activity checks

### Frontend
- `src/components/releases/CreateReleaseDialog.tsx` — contract-aware release creation
- `src/components/labels/MyLabelsTab.tsx` — add signed artist releases overview
- `src/components/labels/MyContractsTab.tsx` — add recoupment progress display
- `src/components/labels/RoyaltyStatementsTab.tsx` — show real royalty data
- New: `src/components/labels/LabelArtistRoster.tsx` — label owner roster view
- New: `src/components/labels/RecoupmentTracker.tsx` — advance recoupment visualization

### Version
- `src/components/VersionHeader.tsx` — bump to v1.0.897
- `src/pages/VersionHistory.tsx` — changelog

### Database (if needed)
- May need migration to add `deal_type_effects` config or similar lookup table for deal-type-specific revenue rules

---

## Scope Note

This is a large multi-phase plan. I'll implement **Phase 1 (Label Contracts Actually Work)** first as it's the most impactful — making contracts affect releases and revenue. Phases 2-4 can follow in subsequent iterations.

