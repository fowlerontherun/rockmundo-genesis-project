

# Housing System Enhancements (v1.0.796)

## Overview
Add property selling, renting out owned properties, daily upkeep costs, and better affordability feedback to the housing system.

## Changes

### 1. Database Migration
- Add columns to `player_properties`: `daily_upkeep` (integer, calculated from tier/price), `is_rented_out` (boolean, default false), `rental_income_daily` (integer, default 0), `sold_at` (timestamp, nullable)
- The `daily_upkeep` will be set on insert based on the property tier (roughly 0.01-0.02% of base price per day)

### 2. Sell Property Feature
- Add a `useSellProperty` mutation in `useHousing.ts`
- Sells at 70% of the original purchase price (depreciation)
- Credits cash back to the player's profile
- Marks property with `sold_at` timestamp (soft delete) or hard deletes the row
- Add "Sell" button on each owned property card in the "My Properties" tab

### 3. Rent Out Property Feature
- Add a `useToggleRentOut` mutation in `useHousing.ts`
- Players can toggle renting out a property they own
- Rental income is calculated as ~0.5% of purchase price per day
- Show "Rent Out" / "Stop Renting" toggle button on owned property cards
- Display daily rental income on the card when rented out

### 4. Daily Upkeep Costs
- Calculate upkeep as a percentage of the property's base price (roughly $base_price * 0.001 per day)
- Display daily upkeep cost on each owned property card
- Display total daily upkeep across all properties in the "My Properties" tab header
- Note: Actual daily deduction would require a scheduled function (out of scope for now), but the cost will be displayed and tracked

### 5. Buy Tab Affordability Check
- Fetch the player's current cash balance
- Show player's cash balance at the top of the Buy tab
- Disable the "Buy" button and show "Can't Afford" when cash is insufficient
- The mutation already checks server-side, but this adds client-side UX feedback

### 6. UI Updates to "My Properties" Tab
Each property card will show:
- Property name, country, image (existing)
- Purchase price (existing)
- Daily upkeep cost (new)
- Rental status and daily income if rented out (new)
- "Sell for $X" button (new)
- "Rent Out" / "Stop Renting" button (new)
- Net daily cost/profit summary (new)

### 7. Version Update
- Bump version to `1.0.796` in `VersionHeader.tsx`
- Add changelog entry in `VersionHistory.tsx`

## Technical Details

### Database SQL
```sql
ALTER TABLE player_properties
  ADD COLUMN daily_upkeep integer NOT NULL DEFAULT 0,
  ADD COLUMN is_rented_out boolean NOT NULL DEFAULT false,
  ADD COLUMN rental_income_daily integer NOT NULL DEFAULT 0;
```

### Sell Price Formula
```
sellPrice = Math.round(purchasePrice * 0.7)
```

### Daily Upkeep Formula
```
dailyUpkeep = Math.round(basePrice * 0.001)  -- ~0.1% of property value per day
```

### Daily Rental Income Formula
```
rentalIncome = Math.round(basePrice * 0.005)  -- ~0.5% of property value per day
```

### Files Modified
- `src/hooks/useHousing.ts` -- add sell, rent-out mutations; update PlayerProperty type; add upkeep calculation helper
- `src/pages/Housing.tsx` -- update Buy tab with cash display and affordability, update My Properties tab with sell/rent/upkeep UI
- `src/components/VersionHeader.tsx` -- bump to 1.0.796
- `src/pages/VersionHistory.tsx` -- add changelog entry
