

# Plan: Tattoo Parlour System (v1.0.912)

## Overview

Add tattoo parlours to cities with quality tiers and pricing. Players visit parlours to get tattoos placed on specific body parts, building full sleeves over time. Tattoos have genre-based modifiers (boost Rock/Metal, penalize Pop/Classical), infection risk from low-quality parlours, and visible 3D rendering on the avatar.

## Database Changes (1 migration)

### `tattoo_parlours` table
- `id`, `city_id` (FK cities), `name`, `quality_tier` (1-5), `price_multiplier`, `infection_risk` (0.0-0.30), `specialties` (text[]), `description`, `created_at`

### `tattoo_designs` table
- `id`, `name`, `category` (sleeve, tribal, japanese, skull, musical, text, geometric, abstract, portrait), `body_slot` (left_upper_arm, left_forearm, right_upper_arm, right_forearm, neck, chest, back, left_hand, right_hand), `base_price`, `ink_color_primary`, `ink_color_secondary`, `description`, `genre_affinity` (jsonb — e.g. `{"Rock": 0.05, "Heavy Metal": 0.08, "Pop": -0.03, "Classical": -0.05}`)

### `player_tattoos` table
- `id`, `user_id` (FK auth.users), `tattoo_design_id` (FK), `parlour_id` (FK), `body_slot`, `quality_score` (1-100, based on parlour quality + variance), `ink_color`, `applied_at`, `is_infected` (bool default false), `infection_cleared_at`, `price_paid`

### RLS
- All tables: authenticated users can SELECT. `player_tattoos` INSERT/UPDATE/DELETE for own `user_id`.

## File Changes

### New Files

1. **`src/data/tattooDesigns.ts`** — Static catalog of ~20 tattoo designs across categories with genre affinity modifiers, body slots, base prices. Sleeve pieces that combine into full sleeves.

2. **`src/utils/tattooEffects.ts`** — Calculate tattoo genre modifiers for a player: sum all tattoo genre affinities, apply quality scaling. Infection penalty (-5% health, -3% performance until cleared). Export `calculateTattooGenreModifier(playerTattoos, songGenre)` returning a multiplier.

3. **`src/pages/TattooParlour.tsx`** — Main page:
   - Select parlour in current city (quality stars, price range, infection risk shown)
   - Browse designs by category, see genre effects (green for boost, red for penalty)
   - Body slot selector with visual preview
   - Purchase flow with confirmation showing price, quality estimate, infection risk
   - "Your Tattoos" tab showing collection with quality badges

4. **`src/components/tattoo/TattooBodyPreview.tsx`** — 2D SVG body outline showing existing tattoos on each slot. Color-coded by quality. Click slots to add new tattoos. Shows sleeve progress (e.g. "Left Arm: 3/5 pieces — 60% sleeve").

5. **`src/components/tattoo/TattooDesignCard.tsx`** — Card component showing design name, category, genre effects with colored badges, price, body slot.

6. **`src/components/tattoo/TattooInfectionAlert.tsx`** — Banner shown when player has infection. Links to hospital/wellness for treatment. Shows health penalty.

### Modified Files

7. **`src/components/avatar-system/EnhancedAvatar.tsx`** — Replace simple `renderTattoo()` with new `TattooRenderer` that reads from `player_tattoos` data passed via config. Render per-slot: arm bands/wraps for sleeve pieces, neck ink, chest pieces. Multiple tattoos on same arm combine visually into denser patterns.

8. **`src/hooks/usePlayerAvatar.ts`** — Extend `AvatarConfig` with `tattoos: PlayerTattoo[]` array. Fetch from `player_tattoos` joined with `tattoo_designs` on avatar load.

9. **`src/utils/gigPerformanceCalculator.ts`** — Add `tattooGenreModifier` to `PerformanceFactors`. Apply as multiplier alongside existing `genreSkillMultiplier`.

10. **`src/utils/gigExecution.ts`** — Fetch player tattoos before gig, call `calculateTattooGenreModifier` with gig song genres, pass to performance calculator. If infected, apply performance penalty.

11. **`src/pages/hubs/CharacterHub.tsx`** — Add tattoo parlour tile with Palette icon.

12. **`src/components/ui/navigation.tsx`** / **`HorizontalNavigation.tsx`** — Add Tattoo Parlour nav entry under Character.

13. **`src/App.tsx`** — Add route `/tattoo-parlour`.

14. **`src/components/VersionHeader.tsx`** — Bump to `1.0.912`.

15. **`src/pages/VersionHistory.tsx`** — Add v1.0.912 entry.

## Genre Effect Examples

| Tattoo Category | Rock/Metal | Punk | Hip Hop | Pop | Classical | Jazz |
|----------------|-----------|------|---------|-----|-----------|------|
| Skull | +8% | +6% | +2% | -5% | -8% | -4% |
| Musical Notes | +3% | +2% | +2% | +1% | +3% | +3% |
| Tribal | +5% | +4% | +3% | -3% | -6% | -2% |
| Japanese | +4% | +3% | +1% | -2% | -3% | +1% |
| Text/Script | +2% | +3% | +5% | -2% | -4% | -1% |

## Quality & Infection System

- Parlour quality 1-5 stars. Quality 1: $50-200, 20-30% infection risk, quality score 20-50. Quality 5: $500-2000, 0-2% infection risk, quality score 80-100.
- Infection: random roll on purchase. If infected, -5 health/day until treated at hospital ($200) or clears naturally after 7 game days.
- Tattoo quality affects the genre modifier strength (quality/100 scaling).

## Sleeve System

- Each arm has 5 slots (upper arm, forearm, wrist, shoulder cap, inner arm). Filling all 5 = "Full Sleeve" achievement + bonus 3% genre modifier.
- Visual: more tattoos on an arm = denser 3D mesh patterns wrapping the limb.

