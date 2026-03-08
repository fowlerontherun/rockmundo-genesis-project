

## v1.0.994 — Health Stats → Company Taxes, Venue Bookings & Studio Bookings

### Overview
Three remaining company subsidiary functions have zero health-stat integration:

1. **`process-company-taxes`** — Calculates and processes monthly taxes purely from transaction history. No reputation or morale influence.
2. **`process-venue-bookings`** — Credits venue companies for completed gigs. No reputation scaling on revenue or morale feedback.
3. **`process-studio-bookings`** — Credits studio companies for completed recording sessions. Same gap.

### Changes

#### 1. Company Taxes → Reputation Modifier (`process-company-taxes/index.ts`)
- Fetch company owner's band `reputation_score` via `owner_id → band_members → bands`
- Reputable companies get a small **tax discount** (better compliance reputation with authorities): **1.0x at toxic → 0.9x at iconic** (up to 10% tax reduction)
- This mirrors real-world where established, reputable businesses get better tax treatment/deductions
- If tax payment depletes balance significantly, apply **-2 morale** to owner's band (taxes are stressful)

#### 2. Venue Bookings → Reputation Revenue Scaling (`process-venue-bookings/index.ts`)
- Fetch venue company owner's band `reputation_score`
- Scale venue revenue (ticket cut, bar, merch cut) by reputation: **0.9x toxic → 1.1x iconic**
- Reputable venue owners attract bigger crowds and premium pricing
- On revenue processed, award **+1 morale** to owner's band (business doing well)

#### 3. Studio Bookings → Reputation Revenue Scaling (`process-studio-bookings/index.ts`)
- Fetch studio company owner's band `reputation_score`
- Scale studio session revenue by reputation: **0.9x toxic → 1.1x iconic**
- Reputable studio owners attract higher-paying clients
- On revenue processed, award **+1 morale** to owner's band

#### 4. Version bump + changelog
- `VersionHeader.tsx` → v1.0.994
- `VersionHistory.tsx` → Add changelog entry

### Technical Detail

```text
Reputation → Revenue scaling (all three):
  repMod = 0.9 + ((repScore + 100) / 200) * 0.2  // 0.9x to 1.1x

Tax discount:
  taxMod = 1.0 - ((repScore + 100) / 200) * 0.1   // 1.0x to 0.9x (lower = less tax)
```

### Files to modify
- `supabase/functions/process-company-taxes/index.ts`
- `supabase/functions/process-venue-bookings/index.ts`
- `supabase/functions/process-studio-bookings/index.ts`
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

