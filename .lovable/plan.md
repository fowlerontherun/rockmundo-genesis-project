

# Wellness, Hospitals, Addictions & Holidays Expansion -- v1.0.688

## Summary
Fully implement the health/wellness ecosystem with working hospital visits, an addiction/recovery system tied to nightlife behavior, and a holiday mechanic that blocks most activities but allows songwriting and boosts health recovery.

---

## Part A: Hospital System

The database already has `hospitals` (79 entries across cities) and `player_hospitalizations` tables but they are never used in the frontend or gameplay logic.

### What Gets Built
1. **Hospital Visit UI** -- New "Hospital" tab on the Wellness page showing the nearest hospital (based on player's current city) with:
   - Hospital name, effectiveness rating, cost per day
   - "Check In" button when health is below 30
   - Auto-admission when health drops to 0 (via `shouldForceRest` logic, replacing the simple `rest_required_until` approach)
   - Active hospitalization banner showing discharge countdown

2. **Hospitalization Logic** (new hook `useHospitalization.ts`):
   - Check-in: Creates `player_hospitalizations` record, sets `status: 'admitted'`, calculates discharge time (1-3 days based on effectiveness)
   - During stay: All activities blocked via scheduling conflict system (`player_scheduled_activities` entry for the full duration)
   - Recovery rate: Health recovers at `effectiveness_rating / 10` per hour during stay
   - Discharge: Auto-discharge when `expected_discharge_at` passes or health hits 100
   - Cost: Deducted from player cash on discharge (`cost_per_day * days`)
   - Free hospitals (`is_free = true`) cost nothing but tend to have lower effectiveness

3. **Auto-Hospitalization Trigger** -- Update `useHealthImpact.ts` so when health hits 0, instead of just setting `rest_required_until`, it creates a real hospitalization record in the nearest city hospital

### Files
- **Create**: `src/hooks/useHospitalization.ts`
- **Modify**: `src/pages/Wellness.tsx` (add Hospital tab), `src/hooks/useHealthImpact.ts` (wire auto-hospitalization), `src/utils/healthSystem.ts` (add hospital recovery calculations)

---

## Part B: Addiction & Recovery System

A new gameplay layer where sustained risky behavior (heavy partying, nightlife excess) can trigger addiction status effects that debuff the player until they seek recovery.

### Database Migration
- **New table: `player_addictions`**
  - `id` (uuid), `user_id`, `profile_id`
  - `addiction_type` (text: 'alcohol', 'substances', 'gambling', 'partying')
  - `severity` (integer 1-100, starts at 20, escalates with continued behavior)
  - `status` (text: 'active', 'recovering', 'recovered', 'relapsed')
  - `triggered_at` (timestamp)
  - `recovery_started_at` (timestamp, nullable)
  - `recovered_at` (timestamp, nullable)
  - `recovery_program` (text: 'therapy', 'rehab', 'cold_turkey', nullable)
  - `days_clean` (integer, default 0)
  - `relapse_count` (integer, default 0)
  - `created_at`, `updated_at`

### Addiction Triggers
- Checked after nightlife activities and influenced by `player_behavior_settings`:
  - `partying_intensity = 'legendary'`: 8% chance per nightlife event
  - `partying_intensity = 'heavy'`: 4% chance
  - `partying_intensity = 'moderate'`: 1% chance
  - `afterparty_attendance = 'always'`: doubles the chance
- Types are randomly selected based on the activity context (bar crawl = alcohol, underground = substances, crypto/underworld = gambling)

### Addiction Effects (Debuffs)
- **Health**: Recovery rate reduced by `severity / 4` percent
- **Energy**: Max energy capped at `100 - severity / 2`
- **Performance**: XP gains reduced by `severity / 5` percent
- **Cash**: Random "cravings" events drain small amounts of cash
- **Reputation**: Scandal risk increases proportionally

### Recovery Paths
1. **Therapy** ($100/session, requires 5-10 sessions): Slow but steady, reduces severity by 5-10 per session. Available on Wellness page
2. **Rehab** ($500-2000 lump sum, 7-14 day block): Activity-blocked like hospitalization but with high recovery rate. Creates scheduled activity blocking everything
3. **Cold Turkey** (free, risky): No cost but severity drops slowly (1/day) and relapse risk is high (10% daily roll)
4. **Relapse**: If `days_clean < 30`, there's a daily chance of relapse based on behavior settings. Relapse resets severity to 50% of previous peak

### UI
- New "Addictions" section on Wellness page showing active addictions with severity bars
- Recovery program selector (Therapy/Rehab/Cold Turkey)
- "Days Clean" counter with milestone rewards (7, 30, 90, 365 days)
- Warning alerts when addiction risk is high based on current behavior settings

### Files
- **Create**: `src/hooks/useAddictions.ts`, `src/utils/addictionSystem.ts`
- **Modify**: `src/pages/Wellness.tsx` (add Addictions tab/section), `src/hooks/useBehaviorSettings.ts` (add addiction risk calculation)

---

## Part C: Holiday System

Players can take holidays that significantly boost health recovery but block all activities except songwriting for the duration.

### Database Migration
- **New table: `player_holidays`**
  - `id` (uuid), `user_id`, `profile_id`
  - `destination` (text -- flavor text like "Beach Resort", "Mountain Cabin", "Tropical Island")
  - `started_at` (timestamp)
  - `ends_at` (timestamp)
  - `duration_days` (integer: 3, 5, 7, or 14)
  - `cost` (integer -- scales with duration and destination quality)
  - `health_boost_per_day` (integer -- 15-25 depending on destination)
  - `status` (text: 'active', 'completed', 'cancelled')
  - `created_at`

### Holiday Destinations (seeded data)
| Destination | Duration Options | Cost/Day | Health/Day | Flavor |
|---|---|---|---|---|
| Local Staycation | 3, 5 | $20 | 15 | Rest at home |
| Beach Resort | 5, 7 | $80 | 20 | Sun and relaxation |
| Mountain Cabin | 3, 7 | $50 | 18 | Fresh air and peace |
| Tropical Island | 7, 14 | $150 | 25 | Ultimate getaway |
| Countryside Retreat | 3, 5 | $40 | 17 | Quiet countryside |
| Spa Resort | 5, 7 | $120 | 22 | Luxury pampering |

### Mechanics
- **Booking**: Available from Wellness page. Player picks destination and duration, pays upfront
- **Activity Blocking**: Creates a `player_scheduled_activities` entry for the full duration that blocks ALL activities **except songwriting**. The scheduling conflict check (`check_scheduling_conflict`) already prevents double-booking -- the holiday entry will cover the entire period
- **Songwriting Exception**: The songwriting system will check if the current blocking activity is a holiday and allow it through. Songwriting during holidays gets a small creativity bonus (+10% quality) as "inspired by travel"
- **Health Recovery**: Each in-game day of the holiday, health increases by the destination's `health_boost_per_day` amount
- **Early Return**: Player can cancel a holiday early but loses remaining cost (no refund) and health boost stops
- **Addiction Recovery Bonus**: If player has an active addiction and takes a holiday, `days_clean` progress counts double
- **Cooldown**: Cannot take another holiday within 14 days of completing one

### UI
- New "Holidays" card on Wellness page with destination picker
- Active holiday banner showing countdown and daily health gain
- Destination cards with cost, duration, and health boost preview

### Files
- **Create**: `src/hooks/useHolidays.ts`
- **Modify**: `src/pages/Wellness.tsx` (add Holidays section/tab), `src/hooks/useActivityBooking.ts` (add songwriting exception for holidays)

---

## Part D: Wellness Page Restructure

The current Wellness page has 4 tabs (Overview, Physical, Mental, Lifestyle). It needs to accommodate the new systems. New tab structure:

- **Overview** -- Stats dashboard (keep existing)
- **Activities** -- Merge Physical + Mental + Lifestyle into one tab with all current actions (rest, exercise, meditation, therapy, nutrition)
- **Hospital** -- Hospital check-in/status, hospitalization history
- **Addictions** -- Active addictions, recovery programs, days clean tracker
- **Holidays** -- Book holidays, active holiday status

---

## Part E: Version Update
- Bump to v1.0.688
- Changelog entry for all three systems

---

## Technical Details

### Migration SQL
```text
1. Create player_addictions table with columns listed above
2. Create player_holidays table with columns listed above  
3. Seed holiday_destinations reference data (or embed in code as constants)
4. Add RLS policies for both new tables (user can only see/modify own records)
```

### Files to Create
- `src/hooks/useHospitalization.ts` -- hospital check-in/out, active hospitalization queries
- `src/hooks/useAddictions.ts` -- addiction queries, recovery mutations, relapse checks
- `src/utils/addictionSystem.ts` -- trigger calculations, severity effects, recovery math
- `src/hooks/useHolidays.ts` -- holiday booking, active holiday queries, cancellation

### Files to Modify
- `src/pages/Wellness.tsx` -- restructure tabs, add Hospital/Addictions/Holidays sections
- `src/hooks/useHealthImpact.ts` -- wire auto-hospitalization on health=0
- `src/utils/healthSystem.ts` -- add hospital recovery rate calculations
- `src/hooks/useActivityBooking.ts` -- add songwriting exception during holidays
- `src/hooks/useBehaviorSettings.ts` -- export addiction risk calculation
- `src/components/VersionHeader.tsx` -- bump to 1.0.688
- `src/pages/VersionHistory.tsx` -- changelog

### Key Integration Points
- Addiction checks hook into nightlife event resolution (existing behavior settings)
- Hospital auto-admission replaces the current basic `rest_required_until` mechanic
- Holiday blocking uses the existing `player_scheduled_activities` + `check_scheduling_conflict` RPC
- All three systems affect the health/energy values on `profiles` table

