

# Plan: Tattoo Artist Reputation System (v1.0.913)

## Overview

Add named tattoo artists to parlours, each with fame/reputation levels that directly influence tattoo quality. Famous artists cost more, give higher quality, and can be booked for custom designs. Artists level up over time based on how many tattoos they do.

## Database Changes (1 migration)

### `tattoo_artists` table
- `id`, `parlour_id` (FK tattoo_parlours), `name`, `nickname`, `fame_level` (1-100), `specialty` (text — matches tattoo category), `quality_bonus` (integer, 0-30 — added to parlour base quality), `price_premium` (numeric, 1.0-3.0), `accepts_custom` (boolean — only high-fame artists), `bio`, `total_tattoos_done` (integer), `created_at`

### `custom_tattoo_requests` table
- `id`, `user_id` (FK auth.users), `artist_id` (FK tattoo_artists), `description` (text — player's custom idea), `body_slot`, `status` (pending/accepted/completed/rejected), `quoted_price`, `estimated_quality`, `completed_tattoo_id` (FK player_tattoos, nullable), `created_at`, `updated_at`

### Modify `player_tattoos`
- Add `artist_id UUID REFERENCES tattoo_artists(id)` — tracks which artist did the work

### RLS
- `tattoo_artists`: SELECT for authenticated
- `custom_tattoo_requests`: full CRUD for own user_id

### Seed Data
- ~15 artists spread across parlours (inserted via seed in migration since parlours are also seeded). Artists at tier-5 parlours have fame 70-95 and accept customs. Tier-1 parlours have fame 5-20 artists.

## File Changes

### New: `src/components/tattoo/TattooArtistCard.tsx`
- Card showing artist name, nickname, fame bar (1-100), specialty badge, quality bonus indicator, price premium, "Book Custom" button (if `accepts_custom`)

### New: `src/components/tattoo/CustomTattooDialog.tsx`
- Dialog for requesting a custom design from a famous artist
- Text input for description, body slot selector, shows quoted price (base_price × parlour multiplier × artist premium × 1.5 custom surcharge) and estimated quality range
- Submit creates a `custom_tattoo_requests` row with status "pending"
- Auto-completes after a short simulated wait (or immediately for MVP) — generates a custom tattoo entry in `player_tattoos` with boosted quality

### Modified: `src/pages/TattooParlour.tsx`
- Add artist selection step between parlour selection and design browsing
- Fetch artists for selected parlour, display as selectable cards
- Selected artist's `quality_bonus` adds to `calculateTattooQuality` result
- Selected artist's `price_premium` multiplies the final price
- New "Artists" sub-section in the shop tab showing the parlour's roster
- New "Custom Designs" tab alongside Shop/My Tattoos for managing custom requests
- Artist's specialty category designs get a visual highlight ("Artist's Specialty" badge)

### Modified: `src/data/tattooDesigns.ts`
- Update `calculateTattooQuality` to accept optional `artistQualityBonus` parameter
- Update `PlayerTattoo` type to include optional `artist_id` and `artist?: TattooArtist`

### Modified: `src/components/tattoo/TattooDesignCard.tsx`
- Show "Artist Specialty" badge when design category matches selected artist's specialty

### Modified: `src/components/VersionHeader.tsx` → v1.0.913
### Modified: `src/pages/VersionHistory.tsx` → add entry

## Quality Formula Update

```text
finalQuality = calculateTattooQuality(parlourTier) + artistQualityBonus
  - Parlour tier 1 (range 20-50) + artist bonus 0-5  = 20-55
  - Parlour tier 5 (range 85-100) + artist bonus 20-30 = capped at 100
  - Artist specialty match: +5 extra bonus
```

## Artist Fame Tiers

| Fame Range | Title | Quality Bonus | Price Premium | Accepts Custom |
|-----------|-------|--------------|--------------|----------------|
| 1-20 | Apprentice | 0-5 | 1.0x | No |
| 21-45 | Journeyman | 5-12 | 1.2x | No |
| 46-70 | Skilled | 12-20 | 1.5x | Yes |
| 71-90 | Master | 20-28 | 2.0x | Yes |
| 91-100 | Legendary | 28-30 | 2.5-3.0x | Yes |

## Custom Design Flow

1. Player selects a famous artist (fame ≥ 46) → clicks "Book Custom Design"
2. Dialog: enter description, pick body slot, see quoted price and quality estimate
3. Submit → `custom_tattoo_requests` row created as "pending"
4. Instant simulation: request auto-accepted and completed (generates `player_tattoos` entry with artist bonus + 10% custom quality boost, deducts cash)
5. Player sees result in "My Tattoos" tab with "Custom" badge

