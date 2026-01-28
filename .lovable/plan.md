

# Revised XP System - Dual Currency with Streak Bonuses

## Summary of Your Changes

| Aspect | Original Plan | Updated Plan |
|--------|---------------|--------------|
| Daily Stipend | Automatic | **Manual claim only** (click to collect) |
| Activity XP | Manual award via progression | **Auto-added daily** via scheduled process |
| Activity AP | 10-25% of XP | **40-60% of XP** |
| Max Daily Activity XP | No cap | **250 XP cap** |
| Streak Bonuses | None | **7, 14, 30, 100, 365 day milestones** |

---

## Part 1: Updated Currency Model

### Earning Structure

| Source | Skill XP (SXP) | Attribute Points (AP) | Collection Method |
|--------|----------------|----------------------|-------------------|
| **Daily Stipend** | 100 SXP | 10 AP | Manual claim (login & click) |
| **Activity Bonus** | Up to 250 SXP/day | 40-60% of XP | Auto-added daily |
| **Streak Bonuses** | Bonus SXP | Bonus AP | Added when claiming stipend |

### Activity AP Rates (Updated to 40-60%)

| Activity Type | AP Rate | Rationale |
|---------------|---------|-----------|
| Exercise | 60% | Physical activities strongly boost physical attributes |
| Therapy | 60% | Deep personal development |
| Meditation | 55% | Mental/spiritual development |
| Mentor Sessions | 55% | Character building from guidance |
| Busking/Gigs | 50% | Performance builds stage presence |
| Rest | 50% | Recovery and self-care |
| Nutrition | 50% | Physical maintenance |
| University | 45% | Education with character growth |
| Book Reading | 45% | Knowledge with wisdom |
| Recording | 40% | More technical focus |
| YouTube Videos | 40% | Passive learning |

---

## Part 2: Daily Stipend with Streak System

### Streak Milestones & Bonuses

| Streak Days | Bonus SXP | Bonus AP | Total Stipend |
|-------------|-----------|----------|---------------|
| 1 (base) | 0 | 0 | 100 SXP + 10 AP |
| 7 days | +50 SXP | +10 AP | 150 SXP + 20 AP |
| 14 days | +100 SXP | +20 AP | 200 SXP + 30 AP |
| 30 days | +200 SXP | +40 AP | 300 SXP + 50 AP |
| 100 days | +500 SXP | +100 AP | 600 SXP + 110 AP |
| 365 days | +1000 SXP | +200 AP | 1100 SXP + 210 AP |

### Streak Logic

- Streak increments when player claims on consecutive calendar days
- Missing a day resets streak to 0
- Streak bonuses are **cumulative** - if you hit day 14, you get both the 7-day and 14-day bonuses
- Streak count and last claim date stored in `profile_daily_xp_grants` or new columns on `player_xp_wallet`

### UI Updates for DailyStipendCard

```text
+------------------------------------------+
| Daily Stipend                      🔥 14  |
| 2-week streak!                           |
+------------------------------------------+
| Base:          100 SXP + 10 AP           |
| 7-Day Bonus:   +50 SXP + 10 AP           |
| 14-Day Bonus:  +100 SXP + 20 AP          |
| ─────────────────────────────────────    |
| Total Today:   250 SXP + 40 AP           |
+------------------------------------------+
| Next milestone: 30 days (16 days left)   |
|                                          |
| [    Claim Daily Stipend    ]            |
+------------------------------------------+
```

---

## Part 3: Auto Activity XP Processing

### New Edge Function: `process-daily-activity-xp`

Runs automatically (scheduled or via cron) to:

1. Calculate each player's activity XP from the previous day
2. Cap at 250 SXP maximum
3. Calculate AP at 40-60% based on activity type
4. Credit to `skill_xp_balance` and `attribute_points_balance`
5. Record in `profile_daily_xp_grants` with source = "activity_bonus"

### Processing Logic

```typescript
// For each active profile
const activityXp = await calculateDailyActivityXp(profileId, yesterdayStart, yesterdayEnd);
const cappedXp = Math.min(250, activityXp.totalXp);

// Calculate AP based on weighted average of activities
const totalAp = activityXp.activities.reduce((sum, act) => {
  const apRate = AP_RATES[act.activity_type] || 0.50;
  return sum + Math.floor(act.xp_amount * apRate);
}, 0);

// Credit to wallet
await creditDualCurrency(profileId, cappedXp, totalAp, "activity_bonus");
```

### Scheduling

- Run daily at 00:05 UTC (or configurable)
- Process all profiles that had activity the previous day
- Skip profiles that already have an "activity_bonus" grant for that day

---

## Part 4: Database Schema Changes

### Modify `player_xp_wallet` Table

```sql
-- Add dual currency columns
ALTER TABLE player_xp_wallet ADD COLUMN IF NOT EXISTS
  skill_xp_balance INTEGER DEFAULT 0,
  skill_xp_lifetime INTEGER DEFAULT 0,
  skill_xp_spent INTEGER DEFAULT 0,
  attribute_points_balance INTEGER DEFAULT 0,
  attribute_points_lifetime INTEGER DEFAULT 0,
  -- Streak tracking
  stipend_claim_streak INTEGER DEFAULT 0,
  last_stipend_claim_date DATE;
```

### Add Configuration to `game_balance_config`

| Category | Key | Value | Description |
|----------|-----|-------|-------------|
| dual_xp | daily_stipend_sxp | 100 | Base daily Skill XP stipend |
| dual_xp | daily_stipend_ap | 10 | Base daily Attribute Points stipend |
| dual_xp | daily_activity_xp_cap | 250 | Max XP from activities per day |
| dual_xp | streak_7_bonus_sxp | 50 | 7-day streak SXP bonus |
| dual_xp | streak_7_bonus_ap | 10 | 7-day streak AP bonus |
| dual_xp | streak_14_bonus_sxp | 100 | 14-day streak SXP bonus |
| dual_xp | streak_14_bonus_ap | 20 | 14-day streak AP bonus |
| dual_xp | streak_30_bonus_sxp | 200 | 30-day streak SXP bonus |
| dual_xp | streak_30_bonus_ap | 40 | 30-day streak AP bonus |
| dual_xp | streak_100_bonus_sxp | 500 | 100-day streak SXP bonus |
| dual_xp | streak_100_bonus_ap | 100 | 100-day streak AP bonus |
| dual_xp | streak_365_bonus_sxp | 1000 | 365-day streak SXP bonus |
| dual_xp | streak_365_bonus_ap | 200 | 365-day streak AP bonus |
| dual_xp | exercise_ap_rate | 0.60 | Exercise AP rate |
| dual_xp | therapy_ap_rate | 0.60 | Therapy AP rate |
| dual_xp | meditation_ap_rate | 0.55 | Meditation AP rate |
| dual_xp | mentor_ap_rate | 0.55 | Mentor AP rate |
| dual_xp | performance_ap_rate | 0.50 | Gigs/Busking AP rate |
| dual_xp | rest_ap_rate | 0.50 | Rest AP rate |
| dual_xp | education_ap_rate | 0.45 | University/Books AP rate |
| dual_xp | default_ap_rate | 0.50 | Default AP rate |

---

## Part 5: Edge Function Updates

### Update `progression/handlers.ts` - `handleClaimDailyXp`

```typescript
export async function handleClaimDailyXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const todayDate = new Date().toISOString().slice(0, 10);
  const profileId = profileState.profile.id;
  
  // Check if already claimed today
  const { data: existingGrant } = await client
    .from("profile_daily_xp_grants")
    .select("*")
    .eq("profile_id", profileId)
    .eq("grant_date", todayDate)
    .eq("source", "daily_stipend")
    .maybeSingle();

  if (existingGrant) {
    throw new Error("Daily stipend already claimed today");
  }

  // Calculate streak
  const lastClaimDate = profileState.wallet?.last_stipend_claim_date;
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  let newStreak = 1;
  if (lastClaimDate === yesterdayDate) {
    // Consecutive day - increment streak
    newStreak = (profileState.wallet?.stipend_claim_streak ?? 0) + 1;
  }
  // If lastClaimDate is older than yesterday, streak resets to 1

  // Calculate bonuses based on streak
  const baseSxp = 100;
  const baseAp = 10;
  let bonusSxp = 0;
  let bonusAp = 0;

  if (newStreak >= 365) { bonusSxp += 1000; bonusAp += 200; }
  if (newStreak >= 100) { bonusSxp += 500; bonusAp += 100; }
  if (newStreak >= 30) { bonusSxp += 200; bonusAp += 40; }
  if (newStreak >= 14) { bonusSxp += 100; bonusAp += 20; }
  if (newStreak >= 7) { bonusSxp += 50; bonusAp += 10; }

  const totalSxp = baseSxp + bonusSxp;
  const totalAp = baseAp + bonusAp;

  // Update wallet with dual currency and streak
  const currentSxpBalance = profileState.wallet?.skill_xp_balance ?? 0;
  const currentApBalance = profileState.wallet?.attribute_points_balance ?? 0;

  await client.from("player_xp_wallet").upsert({
    profile_id: profileId,
    skill_xp_balance: currentSxpBalance + totalSxp,
    skill_xp_lifetime: (profileState.wallet?.skill_xp_lifetime ?? 0) + totalSxp,
    attribute_points_balance: currentApBalance + totalAp,
    attribute_points_lifetime: (profileState.wallet?.attribute_points_lifetime ?? 0) + totalAp,
    stipend_claim_streak: newStreak,
    last_stipend_claim_date: todayDate,
    last_recalculated: new Date().toISOString(),
  }, { onConflict: "profile_id" });

  // Record grant
  await client.from("profile_daily_xp_grants").insert({
    profile_id: profileId,
    grant_date: todayDate,
    source: "daily_stipend",
    xp_amount: totalSxp,
    metadata: {
      skill_xp: totalSxp,
      attribute_points: totalAp,
      streak: newStreak,
      base_sxp: baseSxp,
      base_ap: baseAp,
      bonus_sxp: bonusSxp,
      bonus_ap: bonusAp,
    },
  });

  return await fetchProfileState(client, profileId);
}
```

### New Edge Function: `process-daily-activity-xp/index.ts`

```typescript
// Scheduled function to auto-credit activity XP daily
serve(async (req) => {
  const supabaseClient = createClient<Database>(...);
  
  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);
  const grantDate = yesterdayStart.toISOString().slice(0, 10);

  // Get all profiles with activity yesterday
  const { data: activities } = await supabaseClient
    .from("experience_ledger")
    .select("profile_id, activity_type, xp_amount")
    .gte("created_at", yesterdayStart.toISOString())
    .lte("created_at", yesterdayEnd.toISOString());

  // Group by profile
  const profileActivities = groupBy(activities, "profile_id");

  for (const [profileId, acts] of Object.entries(profileActivities)) {
    // Check if already processed
    const { data: existing } = await supabaseClient
      .from("profile_daily_xp_grants")
      .select("id")
      .eq("profile_id", profileId)
      .eq("grant_date", grantDate)
      .eq("source", "activity_bonus")
      .maybeSingle();

    if (existing) continue;

    // Calculate XP and AP
    const totalXp = acts.reduce((sum, a) => sum + a.xp_amount, 0);
    const cappedXp = Math.min(250, totalXp);

    let totalAp = 0;
    for (const act of acts) {
      const apRate = getApRateForActivity(act.activity_type);
      totalAp += Math.floor(act.xp_amount * apRate);
    }

    // Credit wallet
    await creditDualCurrency(supabaseClient, profileId, cappedXp, totalAp);

    // Record grant
    await supabaseClient.from("profile_daily_xp_grants").insert({
      profile_id: profileId,
      grant_date: grantDate,
      source: "activity_bonus",
      xp_amount: cappedXp,
      metadata: { skill_xp: cappedXp, attribute_points: totalAp, raw_xp: totalXp },
    });
  }

  return new Response(JSON.stringify({ success: true }), { ... });
});
```

---

## Part 6: UI Updates

### Update `DailyStipendCard.tsx`

- Show current streak count with fire emoji
- Display breakdown of base + streak bonuses
- Show next milestone and days remaining
- Visual progress toward next streak milestone

### Update `XpWalletDisplay.tsx`

- Split display into Skill XP and Attribute Points sections
- Show yesterday's activity bonus separately
- Display streak information

### New Component: `StreakProgressBar.tsx`

Visual indicator showing progress toward next milestone:
```text
Day 18 of 30  [===============----]  12 days to go
```

---

## Part 7: Files Summary

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/process-daily-activity-xp/index.ts` | Auto-credit activity XP daily |
| `src/components/attributes/StreakProgressBar.tsx` | Visual streak progress |
| `src/utils/dualXpSystem.ts` | Helper functions for AP rates and streak calculations |

### Modified Files

| File | Changes |
|------|---------|
| `supabase/functions/progression/handlers.ts` | Dual currency, streak logic for claim |
| `supabase/functions/progression/index.ts` | Updated types for dual currency |
| `src/components/attributes/DailyStipendCard.tsx` | Streak display, bonus breakdown |
| `src/components/attributes/XpWalletDisplay.tsx` | Dual currency display |
| `src/components/attributes/AttributeCard.tsx` | Spend AP instead of XP |
| `src/components/skills/CompactSkillRow.tsx` | Show SXP cost |
| `src/pages/Wellness.tsx` | Activities write to ledger (no wallet change - processed daily) |
| `src/components/VersionHeader.tsx` | Bump to v1.0.540 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

### Database Migration

1. Add dual currency columns to `player_xp_wallet`
2. Add streak tracking columns
3. Add AP column to `profile_daily_xp_grants`
4. Insert configuration values to `game_balance_config`
5. Migrate existing XP to skill_xp_balance

---

## Part 8: Processing Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    DAILY XP FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTIVITIES (during day)                                    │
│  ├── Exercise, Meditation, Busking, etc.                   │
│  ├── Written to experience_ledger only                     │
│  └── No immediate wallet update                            │
│                                                             │
│  MIDNIGHT PROCESS (automatic)                               │
│  ├── Reads previous day's experience_ledger               │
│  ├── Caps XP at 250 SXP                                    │
│  ├── Calculates AP at 40-60% per activity                  │
│  └── Credits skill_xp_balance + attribute_points_balance   │
│                                                             │
│  STIPEND CLAIM (manual - anytime)                          │
│  ├── Player clicks "Claim Daily Stipend"                   │
│  ├── Checks consecutive day streak                          │
│  ├── Calculates base 100 SXP + 10 AP                       │
│  ├── Adds streak bonuses (7/14/30/100/365 day)            │
│  └── Credits to wallet + updates streak counter            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Version Update

- Version: **1.0.540**
- Changes:
  - Progression: Split XP into Skill XP (SXP) for skills and Attribute Points (AP) for attributes
  - Progression: Daily stipend is now manual claim (100 SXP + 10 AP base)
  - Progression: Activity XP auto-credited daily with 250 XP cap
  - Progression: Attribute Points earned at 40-60% of activity XP
  - Progression: Added streak bonuses for 7, 14, 30, 100, and 365 consecutive claim days
  - UI: Streak display with progress toward next milestone
  - Admin: Configurable rates for all dual XP parameters

