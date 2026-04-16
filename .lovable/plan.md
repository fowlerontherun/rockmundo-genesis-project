

# Instrument Crafting System — RPG Feature Plan

## Overview
Add a crafting system where players can build custom instruments and gear from gathered materials. This ties into the existing skill tree (luthiery/tech skills), the equipment system, and the game economy — giving players an alternative to buying gear from the store.

## Core Concept
Players collect **crafting materials** (wood types, pickups, strings, hardware, electronics) and combine them at a **workshop** to produce custom instruments with randomized stat bonuses influenced by their skill level and material quality. Higher crafting skill = better outcomes and rarer recipes.

## Database Schema (6 new tables)

### `crafting_materials`
Catalog of all available materials (e.g., "Mahogany Body Blank", "Alnico V Pickup", "Bone Nut").
- `id`, `name`, `category` (wood, electronics, hardware, strings, finish), `rarity`, `quality_tier` (1-5), `base_cost`, `description`, `image_url`

### `player_crafting_materials`
Player inventory of gathered/purchased materials.
- `id`, `profile_id` (FK profiles), `material_id` (FK crafting_materials), `quantity`, `acquired_at`

### `crafting_recipes`
Defines what materials are needed to craft specific equipment types.
- `id`, `name`, `result_category` (guitar, bass, drums, mic, etc.), `result_subcategory`, `required_skill_slug`, `min_skill_level`, `materials_required` (JSONB array of {material_id, quantity}), `base_craft_time_minutes`, `difficulty_tier`, `rarity_output`

### `crafting_sessions`
Active crafting jobs in progress.
- `id`, `profile_id`, `recipe_id`, `started_at`, `completes_at`, `status` (in_progress, completed, failed, collected), `quality_roll`, `bonus_stats` (JSONB)

### `crafting_blueprints`
Unlockable blueprints players discover or earn.
- `id`, `profile_id`, `recipe_id`, `unlocked_at`, `source` (purchased, mentor, achievement, drop)

### Extend `equipment_items`
Add nullable column `crafted_by_profile_id` and `is_crafted` boolean to tag player-made gear, plus `custom_name` for personalization.

## Game Mechanics

### Material Acquisition
- **Purchase** from a Materials Shop (new tab in Equipment Store)
- **Drops** from gig rewards, festival prizes, jam session loot
- **Salvage** existing equipment for parts (destroys the item, returns 1-3 materials based on rarity)

### Crafting Process
1. Player selects a **blueprint** they've unlocked
2. System checks materials and skill requirements
3. Crafting takes real game-time (30min–4hrs scaled by difficulty)
4. On completion, a **quality roll** determines the final item stats:
   - Roll influenced by: crafting skill level, material quality, random factor
   - Higher skill = narrower variance, higher floor
   - Chance of **masterwork** (bonus stats) or **flawed** (reduced stats)

### Skill Integration
- New skill tier entries under "Technical" track: **Luthiery Basic → Professional → Mastery**
- Luthiery skill unlocks better recipes and improves quality rolls
- Crafting a successful item awards Luthiery XP

### Custom Naming
- Players can name their crafted instruments (e.g., "The Midnight Strat")
- Crafted items display a "Handcrafted by [Artist Name]" badge

## UI Components

### New Page: `CraftingWorkshop.tsx` (`/crafting`)
- **Blueprints tab**: Grid of unlocked recipes with material requirements
- **Materials tab**: Inventory of owned materials with rarity badges
- **Active Crafts tab**: Progress bars for in-progress crafting sessions
- **Salvage tab**: Select owned equipment to break down for materials

### New Components
- `CraftingRecipeCard.tsx` — Shows recipe, required materials, skill check
- `MaterialInventory.tsx` — Grid of owned materials with quantities
- `CraftingProgress.tsx` — Timer/progress display for active sessions
- `SalvagePanel.tsx` — Equipment selection for dismantling
- `CraftedItemReveal.tsx` — Animated reveal of completed craft with quality rating

### Integration Points
- Add "Crafting" tile to the hub navigation
- Add "Salvage" button to player equipment inventory cards
- Materials as possible gig/festival reward drops

## Files to Create
1. `supabase/migrations/xxx_crafting_system.sql` — All new tables + RLS policies
2. `src/pages/CraftingWorkshop.tsx` — Main crafting page with tabs
3. `src/hooks/useCraftingSystem.ts` — Data fetching and mutations
4. `src/components/crafting/CraftingRecipeCard.tsx`
5. `src/components/crafting/MaterialInventory.tsx`
6. `src/components/crafting/CraftingProgress.tsx`
7. `src/components/crafting/SalvagePanel.tsx`
8. `src/components/crafting/CraftedItemReveal.tsx`
9. `src/data/craftingMaterials.ts` — Seed data constants for materials and starter recipes

## Files to Modify
1. `src/App.tsx` — Add `/crafting` route
2. `src/components/ui/HorizontalNavigation.tsx` — Add Crafting nav link
3. `src/pages/VersionHistory.tsx` — Changelog entry
4. `src/components/VersionHeader.tsx` — Version bump
5. `src/i18n/*.ts` — Translation keys
6. `src/data/skillTree.ts` — Add Luthiery skill tiers

## Seed Data
- ~30 crafting materials across 5 categories
- ~15 starter recipes (acoustic guitar, electric guitar, bass, mic, cable set, etc.)
- Blueprints unlocked via skill milestones and mentor rewards

