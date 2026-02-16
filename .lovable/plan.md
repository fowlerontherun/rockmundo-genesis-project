

# v1.0.723 — Release Hype System and Interactive Release Parties

## Overview

Currently, there is **no dedicated hype tracking system** for releases. The `promotional_campaigns` table exists but its effects (hypeBoost, streamBoost, etc.) are stored as JSON and **never consumed** by the `generate-daily-sales` edge function. This means promotional campaigns have zero actual impact on sales/streams.

This plan introduces a proper **release hype score** that accumulates from multiple activities and directly multiplies first-week sales and streams, plus an **interactive Release Party** mini-game reusing the interview system architecture.

---

## Current State

- **Releases table** has `pre_order_start_date`, `pre_order_count`, and `promotion_budget` columns (all unused)
- **Promotional campaigns** store effects like `hypeBoost: 25` but nothing reads them
- **generate-daily-sales** calculates sales from fame, popularity, quality, and regional multipliers only -- no hype factor
- **Interview system** works via `interview_questions` table (100 questions, 4 options each with effects), `useInterviewSession` hook, and `InterviewModal` component with a 10-second timer per question
- No concept of "release week" sales boost or hype decay

---

## Plan

### 1. Add `hype_score` Column to Releases Table

Add a numeric `hype_score` (default 0, range 0-1000) to the `releases` table. This is the central metric that all hype-building activities contribute to.

### 2. Create `release_party_questions` Table

New table with 100 release-themed questions, same schema as `interview_questions` but with `media_types` replaced by `party_context` (e.g., "album_launch", "single_drop", "listening_party"). Effects will include `hype_mult`, `fan_mult`, `cash_mult`, and `reputation` shifts.

Question categories (20 each):
- **Fan Interaction** — "A fan asks you to play an unreleased track..."
- **Media Spotlight** — "A journalist asks about your creative process..."
- **Party Vibes** — "The crowd energy is dipping, what do you do..."
- **Industry Talk** — "A label exec at the party offers you advice..."
- **Surprises** — "An unexpected guest shows up at your release party..."

### 3. Create `release_party_results` Table

Track completed release parties per release (one party per release, stores answers and effects).

### 4. Hype-Building Activities (What Feeds Hype)

| Activity | Hype Points | Source |
|---|---|---|
| Social Media Blitz campaign | +15 | promotional_campaigns |
| Radio Push campaign | +25 | promotional_campaigns |
| Playlist Placement campaign | +10 | promotional_campaigns |
| Press Tour campaign | +50 | promotional_campaigns |
| Influencer Campaign | +35 | promotional_campaigns |
| Release Party (interactive) | +50 to +150 | Based on answers |
| Twaater posts about release | +5 per post | Manual tagging |
| DikCok videos about release | +10 per video | Manual tagging |
| Pre-orders | +1 per pre-order | pre_order_count |
| Song quality (avg) | +0 to +50 | Calculated at release |

### 5. Release Party Mini-Game

Reuse the `InterviewModal` pattern with a new `ReleasePartyModal` component and `useReleasePartySession` hook:

- Triggered from the Release Manager when a release status is "manufacturing" or "released" (within first 7 days)
- 5 questions (instead of 3 for interviews) with 10-second timer each
- Questions pulled from `release_party_questions` table filtered by release type
- Effects: hype_mult (0.5x-1.5x), fan_mult, cash_mult
- Base hype award: 100 points, modified by answer multipliers (so 50-150 range)
- One party per release, tracked in `release_party_results`
- Party adds hype_score to the release directly

### 6. Hype Impacts Sales (generate-daily-sales Update)

Add a `hypeMultiplier` to the sales calculation:

```
hypeMultiplier = 1 + (hype_score / 500)
```

- 0 hype = 1.0x (no change)
- 250 hype = 1.5x sales
- 500 hype = 2.0x sales  
- 1000 hype = 3.0x sales

**First-week boost**: For releases within 7 days of becoming "released", apply an additional 1.5x multiplier on top of the hype multiplier. This stacks, so a 500-hype release in its first week gets 2.0 x 1.5 = 3.0x sales.

**Hype decay**: Each day after the first week, hype_score decays by 5% (so it naturally fades but never fully disappears). This is applied in `generate-daily-sales`.

### 7. Hype Impacts Streams (update-daily-streams)

Similar multiplier applied in the streaming edge function so hype boosts both sales and streams proportionally.

### 8. Campaign Effects Actually Applied

Update `generate-daily-sales` to check for active `promotional_campaigns` and apply their `hypeBoost` to the release's `hype_score` when the campaign completes (or daily during the campaign).

### 9. UI Changes

- **Release Card**: Show hype meter (progress bar 0-1000) on each release
- **Release Party Button**: "Throw Release Party" button on releases in manufacturing/first-week-released status
- **ReleasePartyModal**: Full interactive mini-game dialog (reuses InterviewModal design)
- **Hype breakdown tooltip**: Shows what contributed to the hype score

---

## Technical Details

### Database Migration

```sql
-- Add hype_score to releases
ALTER TABLE releases ADD COLUMN hype_score integer DEFAULT 0;

-- Release party questions (same structure as interview_questions)
CREATE TABLE release_party_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  party_context text[] DEFAULT '{all}',
  category text NOT NULL,
  option_a_text text NOT NULL,
  option_a_effects jsonb NOT NULL DEFAULT '{}',
  option_b_text text NOT NULL,
  option_b_effects jsonb NOT NULL DEFAULT '{}',
  option_c_text text NOT NULL,
  option_c_effects jsonb NOT NULL DEFAULT '{}',
  option_d_text text NOT NULL,
  option_d_effects jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Release party results
CREATE TABLE release_party_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid REFERENCES releases(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  band_id uuid REFERENCES bands(id),
  questions jsonb NOT NULL DEFAULT '[]',
  total_effects jsonb NOT NULL DEFAULT '{}',
  hype_awarded integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(release_id) -- one party per release
);

-- Seed 100 release party questions across 5 categories
INSERT INTO release_party_questions (question_text, category, party_context, ...) VALUES ...
```

### Files to Create
- `src/components/releases/ReleasePartyModal.tsx` — Interactive mini-game UI (based on InterviewModal)
- `src/hooks/useReleasePartySession.ts` — Game logic hook (based on useInterviewSession)
- `src/components/releases/HypeMeter.tsx` — Visual hype bar component

### Files to Modify
- `supabase/functions/generate-daily-sales/index.ts` — Add hype multiplier, first-week boost, hype decay
- `supabase/functions/update-daily-streams/index.ts` — Add hype multiplier for streams
- `src/components/releases/MyReleasesTab.tsx` — Add hype meter and release party button to ReleaseCard
- `src/components/releases/PromotionalCampaignCard.tsx` — Actually apply hypeBoost to release.hype_score on campaign launch
- `src/components/VersionHeader.tsx` — Version bump
- `src/components/ui/navigation.tsx` — Version bump
- `src/pages/VersionHistory.tsx` — Changelog entry

### Edge Function Changes (generate-daily-sales)

```typescript
// After fetching release data, get hype_score
const hypeScore = release.hype_score || 0;
const hypeMultiplier = 1 + (hypeScore / 500);

// First-week boost check
const releasedDate = release.manufacturing_complete_at || release.created_at;
const daysSinceRelease = (Date.now() - new Date(releasedDate).getTime()) / (1000*60*60*24);
const firstWeekBoost = daysSinceRelease <= 7 ? 1.5 : 1.0;

// Apply to sales calculation
const calculatedSales = Math.floor(
  baseSales * fameMultiplier * popularityMultiplier * qualityMultiplier 
  * marketMultiplier * regionalMultiplier * hypeMultiplier * firstWeekBoost
);

// Daily hype decay (5% after first week)
if (daysSinceRelease > 7 && hypeScore > 0) {
  const decayedHype = Math.floor(hypeScore * 0.95);
  await supabaseClient.from("releases")
    .update({ hype_score: decayedHype })
    .eq("id", release.id);
}
```

