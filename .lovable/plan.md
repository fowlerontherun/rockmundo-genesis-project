

# v1.0.622 -- Massive World Expansion: Cities, Districts, and Transport Routes

## Overview

A large-scale seed migration to dramatically expand the game world with more countries, cities (especially in the UK, USA, and Europe), districts for all new cities, and transport routes for key corridors.

## What's Being Added

### New Cities (50+ new cities)

**United Kingdom (8 new, bringing total from 7 to 15)**
- Leeds, Cardiff, Brighton, Nottingham, Newcastle, Belfast, Portsmouth, Sheffield

**USA (10 new, bringing total from ~12 unique to ~22)**
- Boston, Philadelphia, Denver, Minneapolis, Dallas, Houston, San Diego, Phoenix, Washington DC, Honolulu

**Europe (20+ new cities across new and existing countries)**
- Gothenburg (Sweden), Antwerp (Belgium), Seville (Spain), Porto (Portugal), Naples (Italy), Florence (Italy), Gdansk (Poland), Tallinn (Estonia), Riga (Latvia), Vilnius (Lithuania), Bucharest (Romania), Sofia (Bulgaria), Belgrade (Serbia), Zagreb (Croatia), Ljubljana (Slovenia), Bratislava (Slovakia), Nice (France), Bordeaux (France), Toulouse (France), Edinburgh festival data update

**Rest of World (10+ new cities filling gaps)**
- Kuala Lumpur (Malaysia), Ho Chi Minh City (Vietnam), Accra (Ghana), Marrakech (Morocco), Casablanca (Morocco), Addis Ababa (Ethiopia), Medell&iacute;n (Colombia), Montevideo (Uruguay), Perth (Australia), Brisbane (Australia)

### Districts for All New Cities

Each new city will receive 3-5 unique, thematically appropriate districts in the `city_districts` table with:
- Name, description, vibe
- Safety rating, music scene rating, rent cost
- Tailored to reflect each city's real-world music and cultural identity

### Transport Routes for Key Corridors

Seed `city_transport_routes` with popular/important connections:
- **UK internal**: London to/from Manchester, Birmingham, Edinburgh, Liverpool, Glasgow, Bristol, Leeds, Brighton, Cardiff, Newcastle (bus, train, plane)
- **US East Coast corridor**: NYC to/from Boston, Philadelphia, Washington DC (bus, train, plane)
- **European high-speed rail**: London-Paris, Paris-Brussels, Paris-Amsterdam, Berlin-Prague, Madrid-Barcelona, Rome-Milan
- **Other key routes**: Sydney-Melbourne, Tokyo-Osaka, Toronto-Montreal

### Data Fixes

- Remove duplicate city entries for Atlanta, Detroit, Nashville (keeping the one with more data)
- Set `is_coastal` and `has_train_network` flags correctly for all new cities

## Technical Details

### Migration File

A single new SQL migration file will be created at:
`supabase/migrations/[timestamp]_world_expansion_seed.sql`

Structure:
1. **Deduplicate existing cities** -- delete rows with duplicate names, keeping the most complete entry
2. **Insert new cities** with `ON CONFLICT (name) DO UPDATE` to safely upsert
3. **Insert districts** using subqueries to look up city IDs by name
4. **Insert transport routes** using subqueries for city ID lookups
5. **Update coastal/train flags** for accuracy

### Version Bump

- `src/components/VersionHeader.tsx` -- bump to `1.0.622`
- `src/pages/VersionHistory.tsx` -- add changelog entry documenting the world expansion

### Connected Countries Update

- `src/utils/dynamicTravel.ts` -- extend the `CONNECTED_COUNTRIES` map with new country connections (Estonia-Latvia, Latvia-Lithuania, Croatia-Slovenia, Serbia-Bulgaria, Romania-Hungary, etc.)

### Coastal Cities Update

- `src/utils/dynamicTravel.ts` -- add new coastal cities to the `isDefaultCoastal` fallback list (Brighton, Cardiff, Belfast, Newcastle, Portsmouth, Naples, Nice, Bordeaux, etc.)

### Files Modified

| File | Change |
|---|---|
| `supabase/migrations/[new]_world_expansion_seed.sql` | New migration with all cities, districts, routes |
| `src/utils/dynamicTravel.ts` | Extend CONNECTED_COUNTRIES and coastal city list |
| `src/components/VersionHeader.tsx` | Version to 1.0.622 |
| `src/pages/VersionHistory.tsx` | Changelog entry |

### Scale Estimate

- ~50-60 new cities
- ~200+ new districts (3-5 per new city)
- ~60-80 new transport route entries (bidirectional pairs)
- ~15 new country connections in the travel logic

