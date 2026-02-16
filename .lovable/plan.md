
## v1.0.707 — Addiction Balance, Craving Events, Holiday Prices, and Debt Relief

### 1. Reduce Addiction Trigger Chances
**File:** `src/utils/addictionSystem.ts`

Lower `TRIGGER_CHANCES` by ~40-50%:
- legendary: 0.08 -> 0.05
- heavy: 0.04 -> 0.025
- moderate: 0.01 -> 0.006
- light: 0.002 -> 0.001
- abstinent: stays 0

Reduce afterparty multipliers from 2x/1.3x to 1.6x/1.2x.

---

### 2. Seed 100 Addiction Craving Events
**Database migration** -- insert 100 new rows into `random_events` with `category = 'addiction_craving'`, `is_common = true`, `is_active = true`.

Split across 4 addiction types:

- **Alcohol (~30):** "I could really use a drink", "A cold beer would take the edge off", "The bar is calling my name", etc.
- **Substances (~25):** "I need a hit", "Just one more time won't hurt", "I know a guy who can sort me out", etc.
- **Gambling (~25):** "I should stick a bet on", "The casino is calling", "I feel lucky today", "One spin won't hurt", etc.
- **Partying (~20):** "There's a party I can't miss", "One more night out won't hurt", "I should go out tonight", etc.

Each event has two choices:
- **Option A (Give in):** Short-term boost (energy/morale +10-15) but costs cash ($20-100) and increases addiction severity (+5-15)
- **Option B (Resist):** Health +5, XP +10-20, no negative effects

The effects JSON will include an `addiction_type` field so the trigger function can match events to the player's specific addiction.

---

### 3. Update Random Event Trigger Function
**File:** `supabase/functions/trigger-random-events/index.ts`

Add logic: when processing a player, check if they have an active addiction (query `player_addictions` for `status = 'active'`). If so, give a bonus roll (1 in 5 chance) to trigger a craving event matching their addiction type, filtered from events with `category = 'addiction_craving'`.

---

### 4. Increase Holiday Prices
**File:** `src/hooks/useHolidays.ts`

Updated pricing:
- Local Staycation: $20 -> $50/day
- Beach Resort: $80 -> $200/day
- Mountain Cabin: $50 -> $120/day
- Tropical Island: $150 -> $400/day
- Countryside Retreat: $40 -> $100/day
- Spa Resort: $120 -> $300/day

---

### 5. Debt Relief for Struggling Players
**Database migration** -- a one-time UPDATE to help players currently in severe debt:

After checking the database, **no players are currently in negative cash**. The lowest balance is $500. So no debt relief migration is needed right now. However, as a preventive measure, the migration will include a safety-net statement:

```sql
-- Clear debt flags and give a small cash boost to any player below $0
UPDATE profiles
SET cash = GREATEST(cash, 500),
    debt_started_at = NULL
WHERE cash < 0;

-- Release anyone imprisoned purely for debt
UPDATE profiles
SET is_imprisoned = false
WHERE is_imprisoned = true AND cash >= 0;
```

This ensures if any players fall into debt before the migration runs, they get a fresh start.

---

### 6. Version Bump
**Files:** `src/components/ui/navigation.tsx`, `src/pages/VersionHistory.tsx`

Update to v1.0.707 with changelog:
- Reduced addiction trigger chances by ~40%
- Added 100 craving events for addicted players
- Increased holiday destination prices
- Applied debt relief for struggling players

---

### Technical Summary of Changes

| File | Change |
|------|--------|
| `src/utils/addictionSystem.ts` | Lower trigger chances and afterparty multipliers |
| `src/hooks/useHolidays.ts` | Increase all `costPerDay` values |
| `supabase/functions/trigger-random-events/index.ts` | Add addiction-targeted craving event logic |
| New SQL migration | Seed 100 craving events + debt relief UPDATE |
| `src/components/ui/navigation.tsx` | Version bump to v1.0.707 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |
