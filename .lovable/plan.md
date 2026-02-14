

# Fix Modeling + Offers Dashboard -- v1.0.687

## Problems Identified

### 1. Modeling: Wrong Pattern
Currently, modeling works like a job catalog -- you browse available gigs and book them yourself. The user wants it to work like **media offers**: offers arrive based on your stats, you accept/decline them, similar to how PR media offers come in for bands.

### 2. Offers Dashboard: Entirely Placeholder
The Offers Dashboard page (`/offers`) contains **100% hardcoded fake data** -- 10 static contract records with made-up brands (Starlite Audio, Pulse Cola, etc.). It has no database connection whatsoever. It needs to be rebuilt to pull real data from the player's actual offers across all systems (modeling, media, gigs, sponsorships).

---

## Changes

### Part A: Modeling Offer System Overhaul

**New approach**: Instead of browsing a catalog, modeling offers are **generated and sent to the player** based on their looks/fame, similar to how `pr_media_offers` work.

1. **Database migration**:
   - Add `modeling_offers` table (or reuse `player_modeling_contracts` with a new `offered` status flow):
     - `id`, `user_id`, `gig_id`, `status` (pending/accepted/declined/expired), `compensation` (pre-calculated), `fame_boost`, `expires_at`, `offer_reason` (text explaining why), `created_at`
   - Add `expires_at` column to `player_modeling_contracts` if not present

2. **Offer generation logic** (new utility `src/utils/modelingOfferGenerator.ts`):
   - Function `generateModelingOffersForUser(userId, looks, fame)` that:
     - Queries eligible `modeling_gigs` matching player's looks/fame
     - Randomly picks 1-3 gigs the player qualifies for
     - Generates a compensation amount within the gig's min/max range
     - Creates offers with 3-7 day expiry
     - Adds a thematic reason ("Your look caught the eye of [agency]", "Brand X wants you for their spring campaign")
   - Can be called from an edge function on a cron, or triggered on page visit

3. **Rewrite `ModelingOffersPanel`**:
   - Replace the current "browse and book" catalog with an **incoming offers list** (like MediaOffersTable)
   - Each offer shows: gig title, agency/brand, compensation (fixed, not a range), fame boost, expiry countdown
   - Accept/Decline buttons on pending offers
   - Accepting still opens the date/time scheduling dialog (keep existing booking logic)
   - Declining marks offer as declined
   - Expired offers auto-hide
   - Keep the career progress component at the top
   - Keep the "one active contract" rule

4. **Auto-generate on page visit**: If user has 0 pending offers, trigger generation of 1-3 new offers (with a cooldown so it doesn't spam)

### Part B: Offers Dashboard -- Wire to Real Data

Replace all hardcoded data with a unified view pulling from real database tables:

1. **Data sources to aggregate**:
   - `player_modeling_contracts` -- modeling offers/contracts
   - `pr_media_offers` -- PR media offers
   - `media_offers` -- legacy media offers
   - `gig_offers` -- band gig booking offers
   - `sponsorship_offers` -- sponsorship deals

2. **Rewrite `OffersDashboard.tsx`**:
   - Fetch real data from all offer tables for the current user/band
   - Normalize into a common `ContractRecord` shape for display
   - Keep the existing chart/filter UI structure but wire it to real data
   - KPI cards (Offers Sent/Accepted/Rate/Payout) compute from real records
   - Charts show real trends
   - Table links to actual records

### Part C: Version Update
- Bump to v1.0.687
- Changelog entry describing both fixes

---

## Technical Details

### Files to Create
- `src/utils/modelingOfferGenerator.ts` -- offer generation logic (mirrors `gigOfferGenerator.ts` pattern)

### Files to Modify
- `src/components/modeling/ModelingOffersPanel.tsx` -- rewrite to incoming-offers pattern with accept/decline
- `src/pages/OffersDashboard.tsx` -- replace hardcoded data with real Supabase queries
- `src/pages/Modeling.tsx` -- pass band data if needed, trigger offer generation
- `src/components/VersionHeader.tsx` -- bump to 1.0.687
- `src/pages/VersionHistory.tsx` -- changelog

### Database Migration
- Add `expires_at` and `offer_reason` columns to `player_modeling_contracts` (if reusing that table for the offer flow)
- Or create a dedicated `modeling_offers` table

### Modeling Offers Flow

```text
Player visits /modeling
  -> Check pending offers count
  -> If 0 pending and cooldown expired:
      -> generateModelingOffersForUser()
      -> Creates 1-3 offers based on looks/fame
  -> Display pending offers as cards with Accept/Decline
  -> Accept -> opens date/time picker -> creates scheduled activity
  -> Decline -> marks as declined
  -> Expired offers hidden automatically
```

