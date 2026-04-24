## Problem

Today, relationships look social-rich but **deliver no progression value**:

- All 6 quick actions in `ActionButtons.tsx` (gift, trade, collab, hangout, permissions, ping) only insert a row into `activity_feed`. They grant **0 XP and 0 skill XP**.
- The `player_mentorships` table is empty (0 rows) — the mentorship UI exists but is buried, and even when used, `useRunMentorSession` only updates a counter; it never invokes the `progression` edge function.
- The friendship tier system (`Acquaintance → Bandmate → Inner Circle → Legendary Duo`) lists "perks" like "+5% shared XP from jams" in `config.ts`, but these multipliers are **never applied** anywhere in the codebase.
- 16 accepted friendships exist with ~70 logged events, so players ARE engaging — they just get nothing back.

## Goal

Make every friendly interaction a **simple, visible reward loop**: tap a button → see XP/skill XP land → watch your friendship tier climb → unlock bigger rewards.

---

## Plan

### 1. Add XP rewards to every quick action (`src/features/relationships/components/ActionButtons.tsx`)

Wire each action through the existing `progression` edge function (`award_action_xp`). Server-side enforcement via a new `relationship_xp_log` table prevents farming.

| Action | Action XP | Skill XP target | Daily cap per friend |
|---|---|---|---|
| Quick ping (chat) | +2 | — | 5 pings/day |
| Send gift | +5 | charisma +3 | 3 gifts/day |
| Plan hangout | +8 | charisma +5 | 2/day |
| Secure trade | +10 | business +5 | 3/day |
| Launch jam collab | +15 | performance +10 | 2/day |
| Launch gig collab | +20 | performance +15 | 1/day |
| Launch songwriting collab | +20 | songwriting +15 | 1/day |

Toast now reads: *"+15 XP, +10 Performance Skill XP — Inner Circle 340/600"*.

### 2. New "Co-op Bonuses" — friendship tier multipliers actually fire

When a player completes any of these activities **with a friend** (jam, gig, songwriting session, rehearsal):

- **Bandmate** (250+ affinity): +5% bonus XP applied at the source edge function
- **Inner Circle** (600+): +10% bonus XP + 5% bonus cash
- **Legendary Duo** (1000+): +15% bonus XP + 10% cash + 5% fame

Implementation: small helper `applyFriendshipBonus(profileIds, baseXp)` called inside `complete-rehearsals`, `complete-gig`, `cleanup-songwriting`, and `complete-recording-sessions` (which already exist and award XP). Looks up tier from a new server-side `get_friendship_tier(a, b)` SQL function reading the affinity score from the `relationship_xp_log` rollup.

### 3. Daily "Friend Streak" bonus

A new lightweight system: interacting with **any** friend at least once per day grants a daily streak bonus that grows:

- Day 1: +10 XP
- Day 3: +25 XP + 10 skill XP (charisma)
- Day 7: +50 XP + 25 skill XP + small cash
- Day 14+: +100 XP + 50 skill XP + +1 attribute XP

Tracked via a new `daily_social_streaks` table (one row per profile per day). Surfaced as a top banner on `/relationships` with a flame icon and current streak count.

### 4. Activate the dormant Mentorship system

Since `player_mentorships` has 0 rows, fold it into the friend detail panel as a **one-tap "Teach a skill"** action between accepted friends:

- New button in `FriendDetailPanel.tsx` → "Teach [skill]" picker
- Mentor gets +20 XP + +5 skill XP in their teaching skill
- Mentee gets +30 XP + +15 skill XP in the focus skill
- Cooldown: 1 session per pair per 6h (server-enforced)
- Fix `useRunMentorSession` to actually call the `progression` edge function for both parties (currently just bumps a column).

### 5. Visible rewards UI

Update `FriendDetailPanel.tsx` and `ActionButtons.tsx` to show what each button gives **before** tapping it (small XP/skill chip on each button: `+15 XP · +10 Perf`). Add a "Rewards earned with this friend" stat block in the detail panel showing lifetime XP gained from this friendship.

### 6. Database migration

```sql
-- Track XP awards per friend pair to enforce caps and roll up affinity
CREATE TABLE relationship_xp_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  other_profile_id uuid not null,
  pair_key text not null,           -- sorted "a:b"
  action_type text not null,
  xp_awarded int not null default 0,
  skill_xp_awarded int not null default 0,
  skill_slug text,
  created_at timestamptz not null default now()
);
CREATE INDEX ON relationship_xp_log (profile_id, other_profile_id, created_at);
CREATE INDEX ON relationship_xp_log (pair_key);
-- RLS: only owners can read/insert their own rows
ALTER TABLE relationship_xp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read" ON relationship_xp_log FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "owners insert" ON relationship_xp_log FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE TABLE daily_social_streaks (
  profile_id uuid primary key,
  current_streak int not null default 0,
  last_interaction_date date not null,
  total_days int not null default 0,
  updated_at timestamptz not null default now()
);
ALTER TABLE daily_social_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON daily_social_streaks FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Helper for tier lookups (used by other edge functions)
CREATE OR REPLACE FUNCTION get_friendship_tier(profile_a uuid, profile_b uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(SUM(xp_awarded), 0) >= 1000 THEN 'legendary-duo'
    WHEN COALESCE(SUM(xp_awarded), 0) >= 600  THEN 'inner-circle'
    WHEN COALESCE(SUM(xp_awarded), 0) >= 250  THEN 'bandmate'
    ELSE 'acquaintance'
  END
  FROM relationship_xp_log
  WHERE pair_key = LEAST(profile_a::text, profile_b::text) || ':' || GREATEST(profile_a::text, profile_b::text);
$$;
```

### 7. New edge function: `relationship-action`

Single endpoint that:
1. Validates the action + friend pair
2. Checks the per-action daily cap from `relationship_xp_log`
3. Calls `progression.award_action_xp` for the player (and the friend if they're online/eligible)
4. Updates `daily_social_streaks` (advances streak if first interaction today, resets if >1 day gap)
5. Inserts the affinity row in `activity_feed` (current behaviour)
6. Returns: `{ xp_awarded, skill_xp_awarded, new_tier, streak_days, cap_remaining }`

Frontend `ActionButtons.tsx` calls this single function for all 7 actions instead of using `recordRelationshipEvent` directly.

---

## Files affected

**Created**
- `supabase/migrations/<timestamp>_relationship_xp_system.sql`
- `supabase/functions/relationship-action/index.ts`
- `src/hooks/useRelationshipRewards.ts` (fetches caps + streak)
- `src/features/relationships/components/StreakBanner.tsx`
- `src/features/relationships/components/RewardChip.tsx` (small +XP badge on buttons)

**Modified**
- `src/features/relationships/components/ActionButtons.tsx` — call new edge function, show reward chips, surface returned XP in toast
- `src/features/relationships/components/FriendDetailPanel.tsx` — add "Teach a skill" action + lifetime rewards block
- `src/features/relationships/api.ts` — add `executeRelationshipAction()` wrapper
- `src/features/relationships/config.ts` — central `ACTION_REWARDS` config (single source of truth for caps/XP)
- `src/hooks/usePlayerMentorship.ts` — `useRunMentorSession` invokes `progression` for both parties
- `src/pages/Relationships.tsx` — render `<StreakBanner />` above the tabs
- `supabase/functions/complete-gig/index.ts`, `complete-rehearsals/index.ts`, `cleanup-songwriting/index.ts`, `complete-recording-sessions/index.ts` — apply `get_friendship_tier()` bonus when participants are friends
- `src/components/VersionHeader.tsx`, `src/pages/VersionHistory.tsx` — bump to v1.1.245

## Out of scope (kept simple)

- No new minigames or new screens
- Existing 6-tab Relationships layout stays the same
- Romance, Drama, Family tabs unchanged
- No changes to the deeper `character_relationships` scoring engine — we layer on top of the existing `friendships` + `activity_feed` system

## Result for the player

Tapping "Send gift" now shows: **+5 XP · +3 Charisma · Streak day 4 · 2 gifts left today · Bandmate 320/600**. Doing a gig with a friend silently grants +5–15% bonus XP. Mentoring a friend each day actively grows your skill tree.
