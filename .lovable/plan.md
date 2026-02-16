

## v1.0.711 — Housing and Rentals System

Players can buy country-specific houses or rent standardized apartments. House purchases are one-time costs from the player's cash balance. Rentals are weekly charges deducted automatically.

---

### Overview

**Buying (20 house types per country)**
- Each of the 64 countries gets 20 unique house types with names and prices scaled by that country's cost of living
- Each house has an AI-generated image stylized to match the country's architecture
- One-time purchase deducted from `profiles.cash`
- Players can own multiple houses across countries
- Houses provide a "home base" in that country

**Renting (5 options, same everywhere)**
- 1 Bed Flat, 2 Bed Flat, Deluxe Studio, Luxury Studio, Villa
- Base weekly costs: $200, $350, $600, $1,200, $3,000
- Actual cost scaled by the country's `cost_of_living` index
- Weekly charge deducted from `profiles.cash` by a daily process (cost / 7 per day)
- Player can only have one active rental at a time

---

### Database Tables

**`housing_types`** — 20 house type definitions per country (seeded, ~1,280 rows)
- `id` UUID PK
- `country` TEXT (matches `cities.country`)
- `name` TEXT (e.g. "Victorian Terraced House", "Tokyo Apartment")
- `description` TEXT
- `tier` INT (1-20, cheapest to most expensive)
- `base_price` INT (purchase price in dollars)
- `image_url` TEXT (nullable, for AI-generated images)
- `style_tags` TEXT[] (e.g. ["traditional", "urban"])
- `bedrooms` INT
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ

**`player_properties`** — owned houses
- `id` UUID PK
- `user_id` UUID FK -> auth.users
- `housing_type_id` UUID FK -> housing_types
- `country` TEXT
- `purchased_at` TIMESTAMPTZ
- `purchase_price` INT
- `is_primary` BOOLEAN DEFAULT false
- `created_at` TIMESTAMPTZ

**`rental_types`** — 5 fixed rental options (seeded)
- `id` UUID PK
- `name` TEXT (e.g. "1 Bed Flat")
- `description` TEXT
- `base_weekly_cost` INT
- `tier` INT (1-5)
- `created_at` TIMESTAMPTZ

**`player_rentals`** — active rentals
- `id` UUID PK
- `user_id` UUID FK -> auth.users
- `rental_type_id` UUID FK -> rental_types
- `country` TEXT
- `weekly_cost` INT (actual cost after country scaling)
- `started_at` TIMESTAMPTZ
- `ended_at` TIMESTAMPTZ (null if active)
- `last_charged_at` TIMESTAMPTZ
- `status` TEXT ('active', 'ended', 'defaulted')
- `created_at` TIMESTAMPTZ

### Seed Data

**20 House Types per Country** — names and prices vary by country and are styled to match local architecture. Examples:

| Tier | UK Example | Japan Example | Base Price (UK) |
|------|-----------|---------------|-----------------|
| 1 | Bedsit | Tiny Capsule Room | $15,000 |
| 2 | Studio Flat | 1K Apartment | $30,000 |
| 3 | Terraced House | Danchi Unit | $60,000 |
| ... | ... | ... | ... |
| 18 | Georgian Mansion | Traditional Machiya Estate | $5,000,000 |
| 19 | Country Manor | Mountain Ryokan Resort | $10,000,000 |
| 20 | Royal Estate | Private Island Villa | $25,000,000 |

Prices are scaled by the country's `cost_of_living` index (0-100). A country with cost_of_living=80 pays ~1.6x base, cost_of_living=30 pays ~0.6x base.

**5 Rental Types** (universal):

| Tier | Name | Base Weekly Cost |
|------|------|-----------------|
| 1 | 1 Bed Flat | $200 |
| 2 | 2 Bed Flat | $350 |
| 3 | Deluxe Studio | $600 |
| 4 | Luxury Studio | $1,200 |
| 5 | Villa | $3,000 |

Weekly rental cost = `base_weekly_cost * (0.4 + (cost_of_living / 100) * 1.2)` so cheap countries pay ~40-60% of base, expensive ones pay up to 160%.

---

### AI Image Generation

Each of the 20 house types for each country gets an AI-generated image via a new edge function `generate-housing-image`. This uses the Lovable AI Gateway with the image model to create stylized house images matching the country's architectural style. Images are generated on-demand (first time a player views a house type in that country) and cached in Supabase Storage.

---

### Weekly Rent Collection

Handled inside `process-daily-updates` (existing edge function). Add a new section:
1. Query all `player_rentals` with `status = 'active'`
2. Calculate daily charge = `weekly_cost / 7`
3. Deduct from `profiles.cash`
4. If player cannot afford rent, mark rental as `defaulted` and end it
5. Update `last_charged_at`

---

### Frontend

**New Page: `src/pages/Housing.tsx`**
- Two tabs: "Buy Property" and "Rent"
- **Buy tab**: Shows 20 house types for the player's current country, with images, prices, and a "Buy" button. Filter by tier/price range. Shows owned properties.
- **Rent tab**: Shows 5 rental options with weekly costs scaled to current country. "Start Renting" / "End Lease" buttons. Shows current active rental.
- Property gallery showing owned homes across all countries

**New Hook: `src/hooks/useHousing.ts`**
- `useHousingTypes(country)` — fetch house types for a country
- `useRentalTypes()` — fetch the 5 rental options
- `usePlayerProperties()` — fetch owned properties
- `usePlayerRental()` — fetch active rental
- `useBuyProperty()` mutation — purchase a house (deduct cash)
- `useStartRental()` mutation — start renting (deduct first week)
- `useEndRental()` mutation — end a rental

**Navigation**: Add "Housing" to the "World" section in navigation

---

### Technical Details

#### Migration SQL

The migration will:
1. Create `housing_types`, `player_properties`, `rental_types`, `player_rentals` tables
2. Seed 5 rental types
3. Seed 20 housing types for all 64 countries (1,280 rows) with country-appropriate names and cost_of_living-scaled prices
4. Enable RLS with policies for authenticated users (read all housing/rental types, manage own properties/rentals)

#### Edge Function: `generate-housing-image`

- Accepts `housing_type_id` and `country`
- Generates a stylized image using the Lovable AI Gateway image model (`google/gemini-2.5-flash-image`)
- Prompt includes country name, architectural style, house tier/description
- Stores result in Supabase Storage bucket `housing-images`
- Updates `housing_types.image_url` with the public URL
- Returns the image URL

#### Rent Collection in `process-daily-updates`

Add ~30 lines after the existing daily processing to:
- Fetch active rentals joined with profiles
- Calculate and deduct daily rent (weekly_cost / 7)
- Default rentals where player cash goes negative

---

### Files Summary

| File | Action |
|------|--------|
| New SQL migration | Create 4 tables, seed 1,280 house types + 5 rental types, RLS policies |
| `src/hooks/useHousing.ts` | New hook for all housing queries/mutations |
| `src/pages/Housing.tsx` | New page with Buy/Rent tabs |
| `supabase/functions/generate-housing-image/index.ts` | New edge function for AI house images |
| `supabase/functions/process-daily-updates/index.ts` | Add daily rent deduction section |
| `src/App.tsx` | Add `/housing` route |
| `src/components/ui/navigation.tsx` | Add Housing to World section + version bump |
| `src/components/VersionHeader.tsx` | Version bump to 1.0.711 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

