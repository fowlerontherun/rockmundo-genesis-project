

## v1.0.992 — Health Stats → Promotions, Scheduled PR & Logistics Contracts

### Overview
Three systems still have zero health-stat integration:

1. **`promotions`** — Paid song promotions calculate streams/listeners/revenue purely from budget. No reputation or sentiment modifiers on promotion effectiveness.
2. **`process-scheduled-pr`** — Scheduled PR activities likely lack reputation/sentiment input modifiers on outcome quality.
3. **`process-logistics-contracts`** — Logistics contract completion has no morale/reputation effects despite being a business outcome.

### Changes

#### 1. Promotions → Reputation + Sentiment (`promotions/index.ts`)
- After fetching the song (line 104), look up the user's band and fetch `reputation_score, fan_sentiment_score`
- Reputation scales promotion effectiveness (streams, listeners, revenue): **0.8x toxic → 1.2x iconic** — reputable artists get more organic reach from paid campaigns
- Sentiment scales listener conversion: **0.8x hostile → 1.2x fanatical** — engaged fanbases amplify promotional reach
- Apply both modifiers to `streamIncrease`, `listenersDelta`, and `revenueDelta`

#### 2. Scheduled PR → Reputation Modifier (`process-scheduled-pr/index.ts`)
- Fetch band's `reputation_score` alongside existing data
- Reputation scales PR outcome fame/fan gains: **0.8x → 1.2x**
- Toxic bands get diminished returns from PR efforts (media is less receptive)

#### 3. Logistics Contracts → Morale Boost (`process-logistics-contracts/index.ts`)
- When a logistics contract completes successfully, award +2 morale to the company owner's band
- Successfully completing business deals is a positive event for team morale

#### 4. Version bump + changelog
- `VersionHeader.tsx` → v1.0.992
- `VersionHistory.tsx` → Add changelog entry

### Files to modify
- `supabase/functions/promotions/index.ts`
- `supabase/functions/process-scheduled-pr/index.ts`
- `supabase/functions/process-logistics-contracts/index.ts`
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

