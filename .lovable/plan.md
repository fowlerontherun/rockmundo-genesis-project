

## v1.0.991 — Health Stats → Jam Sessions, Brand Sponsorships & Teaching

### Overview
Three systems still lack full health-stat cross-pollination:
1. **`complete-jam-session`** — Has morale boost output but no reputation/sentiment updates from jam outcomes, and no morale input modifier on XP/synergy
2. **`brand-sponsorships`** — Generates brand offers using only fame. No reputation or sentiment modifiers on offer quality/volume
3. **`process-teaching-sessions`** — Pure XP awards with no reputation boost for community engagement (teaching = positive reputation behavior)

### Changes

#### 1. Jam Session → Reputation + Sentiment (`complete-jam-session/index.ts`)
- After the existing morale boost block (line ~388), also update `reputation_score` and `fan_sentiment_score`
- Good jams (synergy ≥ 80) boost reputation +2 and sentiment +3; decent jams (synergy ≥ 60) boost +1/+1; poor jams no change
- Fetch `reputation_score` and `fan_sentiment_score` in the existing band query (line 403)
- Jam sessions are community/creative events — they naturally build reputation and fan goodwill

#### 2. Brand Sponsorships → Reputation + Sentiment Modifiers (`brand-sponsorships/index.ts`)
- In `handleGenerateOffers`, fetch `reputation_score, fan_sentiment_score` alongside `fame` in the bands query (line 122)
- Reputation gates: toxic bands (rep ≤ -60) are skipped by established/titan tier brands
- Reputation scales `cashOffer`: **0.8x (toxic) to 1.2x (iconic)** multiplier
- Sentiment scales offer count: bands with sentiment ≥ 30 get +1 offer slot (brands want engaged fanbases)

#### 3. Teaching → Reputation Boost (`process-teaching-sessions/index.ts`)
- When a teaching session completes, award +2 reputation to the teacher's band (teaching = positive community behavior)
- Fetch teacher's band via `band_members` lookup, then increment `reputation_score`
- Small but thematic: mentoring is a reputation-positive activity

#### 4. Version bump + changelog
- `VersionHeader.tsx` → v1.0.991
- `VersionHistory.tsx` → Add changelog entry

### Files to modify
- `supabase/functions/complete-jam-session/index.ts`
- `supabase/functions/brand-sponsorships/index.ts`
- `supabase/functions/process-teaching-sessions/index.ts`
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

