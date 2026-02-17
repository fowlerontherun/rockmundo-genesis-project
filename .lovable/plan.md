

# Release Promo Tour -- Multi-Day Marketing Grind (v1.0.830)

## Overview
Add a new "Promo Tour" system to the Release Detail page. When players launch a promo tour for a release, they commit to **half-day blocks (6 hours) over several consecutive days** of gruelling promotional work -- radio call-ins, in-store signings, podcast appearances, street flyering, and social media marathons. Each day's session activity-blocks the player, drains health/energy, increases stress, and costs money, but steadily builds hype for the release.

## What Players Will See

**New "Promotion" tab on the Release Detail page** with:
- A selection of Promo Tour packages (3, 5, or 7 day tours)
- Each day creates a 6-hour scheduled activity block (morning or afternoon slot choice)
- Daily cost shown upfront (e.g. $200/day for transport, materials, food)
- Health/energy/stress impact warnings before booking
- Progress tracker showing completed vs remaining promo days
- Hype accumulated so far with a running total
- Daily activity descriptions (varies each day for flavour)

**Example 3-Day Promo Tour:**
| Day | Activity | Hype | Health Drain | Energy Cost | Stress |
|-----|----------|------|-------------|-------------|--------|
| 1 | Radio Call-Ins and Podcast Taping | +25 | -15 | -20 | +10 |
| 2 | In-Store Signing and Street Flyering | +30 | -20 | -25 | +12 |
| 3 | Social Media Marathon and Fan Meet | +35 | -12 | -15 | +15 |

**During each promo day:**
- Player is activity-blocked for 6 hours (half a day)
- Health and energy drain applied on completion
- Stress increases (new `stress` field on profiles, or we use existing energy as proxy)
- Hype added to the release's `hype_score`
- Small fame and follower gains
- Random bonus events possible (viral moment, celebrity endorsement)

## Promo Tour Packages

| Package | Days | Daily Cost | Total Cost | Total Hype | Health Impact |
|---------|------|-----------|------------|------------|---------------|
| Quick Blitz | 3 | $200 | $600 | ~90 | Moderate |
| Standard Push | 5 | $250 | $1,250 | ~175 | Heavy |
| Full Campaign | 7 | $300 | $2,100 | ~280 | Brutal |

Hype values scale with band fame (higher fame = bigger audiences = more hype per session).

## Technical Plan

### 1. New Component: `PromoTourCard.tsx`

Create `src/components/releases/PromoTourCard.tsx`:
- Shows available tour packages when no active tour exists
- Displays progress tracker when a tour is in progress
- Each package shows: duration, daily cost, total cost, expected hype gain, health warning
- Booking creates all scheduled activity entries upfront for consecutive days
- Uses `player_scheduled_activities` with activity_type `"release_promo"` and half-day blocks
- Deducts total cost from player cash on booking
- Stores tour metadata in release's promotional_campaigns table (or a JSON metadata field)

### 2. Promo Tour Booking Logic

When a player books a promo tour:
1. Check player cash balance covers total cost
2. Check health is above 30 (refuse if exhausted/burned out)
3. Check for scheduling conflicts across all tour days
4. Create one `player_scheduled_activities` entry per day (6-hour blocks)
5. Create a `promotional_campaigns` record to track overall tour progress
6. Deduct cost from player's personal cash

### 3. Promo Tour Completion Logic

Each day's activity completion (handled by existing auto-completion or manual check):
- Apply health drain: 15-20 per session (6hrs at ~3/hr rate)
- Apply energy drain: 15-25 per session
- Add hype to release: 25-40 per day (scaled by fame)
- Add small fame bonus: 5-15 per day
- Add follower bonus: 10-30 per day
- Random event roll (10% chance): viral moment doubles that day's hype

A new `usePromoTourCompletion` hook will check for completed promo day activities and apply rewards/drains.

### 4. Update Release Detail Page

Add a "Promotion" tab to `ReleaseDetail.tsx` containing:
- The existing `PromotionalCampaignCard` (passive campaigns)
- The new `PromoTourCard` (active promo tours)
- A separator between the two sections

### 5. Health System Integration

Add `"release_promo"` to the health cost map in both:
- `src/utils/healthSystem.ts` -- rate of 4/hr (moderate-heavy drain)
- `src/hooks/useHealthImpact.ts` -- same rate for consistency

### 6. Version Bump to v1.0.830

---

## Files to Create
- `src/components/releases/PromoTourCard.tsx` -- main promo tour UI and booking logic
- `src/hooks/usePromoTourCompletion.ts` -- auto-completion hook for promo day rewards

## Files to Edit
- `src/pages/ReleaseDetail.tsx` -- add Promotion tab with both campaign cards
- `src/utils/healthSystem.ts` -- add `release_promo` health drain rate
- `src/hooks/useHealthImpact.ts` -- add `release_promo` to health costs map
- `src/components/VersionHeader.tsx` -- bump to v1.0.830
- `src/pages/VersionHistory.tsx` -- changelog entry

## No Database Migration Needed
Uses existing tables: `promotional_campaigns` for tour tracking, `player_scheduled_activities` for daily blocks, `profiles` for cash/health/energy. Tour day details stored in `metadata` JSON.
