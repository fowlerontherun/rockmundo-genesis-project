
# v1.0.740 -- Expand Travel Connectivity and Reduce All Travel Times by 10%

## Overview

Travel options are calculated dynamically in `src/utils/dynamicTravel.ts` using Haversine distance. Two issues limit connectivity:

1. **Missing country connections**: The `CONNECTED_COUNTRIES` map only has ~30 countries. The 50+ newly added countries (e.g., Ukraine, Georgia, Lebanon, Ecuador) have no train connectivity entries, meaning train travel between neighbors is unavailable.
2. **Inconsistent region values**: New cities were seeded with lowercase regions (`africa`, `asia`, `europe`) while the ship route validation checks capitalized values (`Africa`, `Asia`, `Europe`). This breaks ship travel for ~40 cities.
3. **Travel times**: All transport durations can be reduced by 10% by increasing effective speeds.

---

## Changes

### 1. Expand `CONNECTED_COUNTRIES` map (in `dynamicTravel.ts`)

Add train connections for all new countries with realistic neighbor links:

- **Eastern Europe**: Ukraine (Poland, Romania, Hungary, Moldova, Belarus), Belarus (Poland, Lithuania, Latvia, Russia), Georgia (Turkey, Armenia), Armenia (Georgia, Turkey), Moldova (Ukraine, Romania), Bosnia and Herzegovina (Croatia, Serbia), Albania (Greece, North Macedonia), North Macedonia (Serbia, Bulgaria, Greece, Albania)
- **Middle East**: Lebanon (Turkey, Jordan), Jordan (Saudi Arabia, Lebanon), Saudi Arabia (Jordan, UAE), Qatar (Saudi Arabia), UAE (Saudi Arabia)
- **Asia**: Pakistan (India, China), Bangladesh (India), Sri Lanka (no land), Kazakhstan (Russia, China)
- **Africa**: Senegal (no rail network -- skip), Tunisia (Algeria), Algeria (Tunisia, Morocco), Uganda (Kenya, Tanzania), Tanzania (Kenya, Uganda, Mozambique), DR Congo (no rail), Angola (no rail), Mozambique (Tanzania, South Africa)
- **South/Central America**: Ecuador (Colombia, Peru), Bolivia (Peru, Brazil, Argentina, Paraguay), Paraguay (Brazil, Argentina, Bolivia), Venezuela (Colombia, Brazil), Panama (Costa Rica, Colombia), Costa Rica (Panama), Honduras (Guatemala), Dominican Republic (no rail), Guatemala (Honduras, Mexico), Puerto Rico (no rail), Haiti (no rail)
- **Western Europe**: Luxembourg (France, Germany, Belgium)

### 2. Fix region inconsistency (SQL migration)

Normalize all lowercase region values to capitalized versions:
```sql
UPDATE cities SET region = 'Africa' WHERE region = 'africa';
UPDATE cities SET region = 'Asia' WHERE region = 'asia';
UPDATE cities SET region = 'Europe' WHERE region = 'europe';
UPDATE cities SET region = 'Oceania' WHERE region = 'oceania';
UPDATE cities SET region = 'South America' WHERE region = 'south_america';
UPDATE cities SET region = 'Caribbean' WHERE region = 'caribbean';
UPDATE cities SET region = 'Central America' WHERE region = 'central_america';
UPDATE cities SET region = 'Middle East' WHERE region = 'middle_east';
```

Also add ship routes for new region pairs:
- Caribbean to North America, Caribbean to South America
- Central America to North America, Central America to South America
- Middle East to Africa (Red Sea routes)

### 3. Reduce all travel times by 10%

Increase all transport speeds by ~11% (which produces a 10% time reduction):
- Bus: 50 -> 56 km/h
- Train: 180 -> 200 km/h
- Plane: 850 -> 944 km/h
- Ship: 35 -> 39 km/h
- Private Jet: fixed 3h -> 2.7h (rounded to 2.7)

Also reduce buffer times by 10%:
- Plane: 3h -> 2.7h
- Train: 0.5h -> 0.45h
- Ship: 1h -> 0.9h
- Bus: 0.25h -> 0.22h

### 4. Version bump

Update to v1.0.740 in `VersionHeader.tsx`, `navigation.tsx`, and `VersionHistory.tsx`.

---

## Technical Details

### Files to modify:
1. **`src/utils/dynamicTravel.ts`** -- Add ~40 new country entries to `CONNECTED_COUNTRIES`, increase transport speeds by ~11%, reduce buffer times by 10%, add new valid ship routes for Caribbean/Central America/Middle East, round private jet duration to 2.7h
2. **New SQL migration** -- Normalize region values to capitalized format for consistency
3. **`src/components/VersionHeader.tsx`** -- Version bump to 1.0.740
4. **`src/components/ui/navigation.tsx`** -- Version bump
5. **`src/pages/VersionHistory.tsx`** -- Add changelog entry

### No database route tables needed
The travel system is entirely dynamic (Haversine distance + mode rules). The only DB fix is normalizing region strings so ship route validation works for all cities.
