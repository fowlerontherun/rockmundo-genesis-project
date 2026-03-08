

## v1.0.990 — Morale & Reputation → Live Gig Performance + PR Offer Quality

### Overview
Two major systems lack health-stat input modifiers:
1. **`process-gig-song`** — The core live gig performance engine scores each song purely on skills, equipment, rehearsal, and chemistry. Band morale is completely absent despite being the most natural modifier for live performance.
2. **`generate-pr-offers`** — PR offers are generated based only on fame/fans. Reputation should gate access to higher-tier media and improve offer quality.

### Changes

#### 1. Morale → Live Gig Performance (`process-gig-song/index.ts`)
- After fetching band leader's stage behavior (line ~653), fetch `morale` from the band record
- Apply morale as a final multiplier on the calculated performance score: **0.85x at 0 morale → 1.15x at 100 morale**
- This is a subtle but meaningful modifier — a miserable band plays worse, an euphoric band plays better
- Applied to both song performances AND performance items
- Single additional field in the existing band query (line 653 already queries `bands`)

#### 2. Reputation → PR Offer Generation (`generate-pr-offers/index.ts`)
- Fetch `reputation_score` alongside `fame, total_fans` in the bands query (line 103)
- Reputation gates higher-tier outlets: toxic bands (-60 and below) are excluded from TV and film offers entirely
- Reputation boosts offer compensation: **0.8x (toxic) to 1.2x (iconic)** multiplier on compensation and fame/fan boosts
- Number of offers generated also scales with reputation (respected+ bands get +1 offer slot)

#### 3. Version bump + changelog
- `VersionHeader.tsx` → v1.0.990
- `VersionHistory.tsx` → Add changelog entry

### Files to modify
- `supabase/functions/process-gig-song/index.ts` — Add morale modifier to performance scoring
- `supabase/functions/generate-pr-offers/index.ts` — Add reputation-based gating and offer scaling
- `src/components/VersionHeader.tsx` — Bump version
- `src/pages/VersionHistory.tsx` — Add changelog

