

# v1.0.739 -- Global City Expansion and Small Venue Seeding

## Overview

Currently there are **134 cities** and **408 venues** across 64 countries. Many regions are underrepresented (most countries have only 1 city), and 55 existing cities have **zero venues**. This update will:

1. **Add ~80 new cities** to fill gaps in Africa, Asia, South America, the Middle East, Eastern Europe, and underrepresented Western nations
2. **Seed 2-3 small music venues** for every city that currently has zero venues (55 existing + ~80 new = ~135 cities needing venues)
3. Total: roughly **300-400 new small venues** across all new and venue-less cities

---

## New Cities by Region (~80 total)

### Africa (currently 4 cities: Accra, Addis Ababa, Lagos, Nairobi, Cape Town, Johannesburg)
- **New:** Dakar (Senegal), Dar es Salaam (Tanzania), Kinshasa (DR Congo), Luanda (Angola), Maputo (Mozambique), Tunis (Tunisia), Algiers (Algeria), Kampala (Uganda)

### Asia & Middle East (currently ~15 cities)
- **New:** Hanoi (Vietnam), Bangkok suburbs Chiang Mai (Thailand), Osaka (Japan), Pune/Chennai (India), Karachi/Lahore (Pakistan), Dhaka (Bangladesh), Colombo (Sri Lanka), Beirut (Lebanon), Amman (Jordan), Doha (Qatar), Riyadh (Saudi Arabia), Almaty (Kazakhstan)

### South America (currently 5 cities)
- **New:** Bogota already exists; add Quito (Ecuador), La Paz (Bolivia), Asuncion (Paraguay), Caracas (Venezuela), Panama City (Panama), San Jose (Costa Rica), Tegucigalpa (Honduras), Santo Domingo (Dominican Republic), Port-au-Prince (Haiti), San Juan (Puerto Rico), Guatemala City (Guatemala)

### Eastern Europe (currently ~12 cities)
- **New:** Minsk (Belarus), Kyiv (Ukraine), Skopje (North Macedonia), Tirana (Albania), Sarajevo (Bosnia), Tbilisi (Georgia), Yerevan (Armenia), Chisinau (Moldova)

### Western Europe gaps
- **New:** Luxembourg City (Luxembourg), Edinburgh (UK), Cork (Ireland), Malaga (Spain), Lyon (France), Stuttgart (Germany), Zurich (Switzerland)

### Oceania
- **New:** Auckland (New Zealand), Gold Coast (Australia), Wellington (New Zealand)

Each city will include: name, country, latitude, longitude, population, region, timezone, music_scene rating, dominant_genre, cost_of_living, is_coastal, has_train_network

---

## Small Venue Seeding

For every city without venues (existing 55 + new ~80), seed **2-3 small venues** with:
- **Types:** cafe, indie_venue, club (small music-focused)
- **Capacity:** 50-250 (small/intimate)
- **Prestige level:** 1 (starter venues)
- **Base payment:** 0-300
- **Realistic names** reflecting local culture (e.g., "The Vinyl Den" not "City Cafe")
- **Requirements:** minimal (min_fame: 0, min_fans: 0) so new players can perform
- Standard slot_config with 4 slots per day

---

## Technical Details

### Database changes
One SQL migration containing:
1. INSERT ~80 new rows into `cities` (with ON CONFLICT (name, country) DO NOTHING to avoid duplicates)
2. INSERT ~350 new rows into `venues` using subqueries to look up `city_id` by name/country

### Files to modify
1. **New SQL migration** -- Seed cities and small venues
2. **`src/components/VersionHeader.tsx`** -- Version bump to 1.0.739
3. **`src/components/ui/navigation.tsx`** -- Version bump
4. **`src/pages/VersionHistory.tsx`** -- Add changelog entry

### Venue template per city (example)
```text
INSERT INTO venues (name, city_id, capacity, venue_type, prestige_level, base_payment, ...)
VALUES (
  'The Vinyl Den',
  (SELECT id FROM cities WHERE name = 'Dakar' AND country = 'Senegal'),
  80, 'indie_venue', 1, 150, ...
);
```

Each venue gets: slot_config (4 slots), requirements (empty/zero), venue_cut 0.20, band_revenue_share 0.50, equipment_quality 2-3, sound_system_rating 2-3, no security required, alcohol_license true/false varying.

