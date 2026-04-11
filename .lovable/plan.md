

## DikCok Weekly Challenges + Fan Tips (v1.1.153)

### Current State
- `dikcok_challenges` table exists with name, theme, requirements, rewards, sponsor, dates -- but has **0 rows** (seed data expired or was never inserted)
- `dikcok_challenge_entries` table exists (challenge_id, video_id, band_id, score) -- 0 entries
- Challenge cards render with progress bars, requirements, rewards, and an "Enter Challenge" button -- but the button has no mutation wired up
- No fan tipping system exists anywhere in the codebase
- No recurring/weekly challenge rotation logic

### Plan

#### 1. Weekly Challenge Rotation System
- Add `week_number` (integer) and `recurring` (boolean) columns to `dikcok_challenges`
- Create a DB function `rotate_weekly_challenges()` that:
  - Deactivates expired challenges
  - Generates a new weekly challenge from a template pool (theme + requirements + rewards randomly composed)
- Seed **10+ challenge templates** covering themes like "Acoustic Unplugged", "Cover Battle", "Behind the Scenes", "Fan Duet", "Genre Mashup"
- Call rotation on page load if no active challenges exist (client-side fallback)

#### 2. Challenge Entry Flow (Wire Up the Button)
- Update `DikCokChallengeCard` to accept an `onEnter` mutation that inserts into `dikcok_challenge_entries`
- Track which challenges the player has entered (query entries by band_id)
- When entering, optionally link an existing video or prompt to create a new one tagged with the challenge
- Show entry count and leaderboard (top scores) on each challenge card

#### 3. Challenge Rewards Distribution
- When a challenge ends, calculate winners by score (views + hype + fan gain weighted)
- Award rewards: cash bonus to band balance, fame boost, and exclusive badge text stored on the entry
- Show "Past Challenges" section with winners

#### 4. Fan Tips System (Economy Sink)
- Create `dikcok_fan_tips` table: `id`, `video_id`, `tipper_profile_id`, `amount` (integer, in-game cash), `message` (optional text), `created_at`
- RLS: anyone authenticated can insert (spending their own cash); video creator can read tips on their videos
- Add a "Tip" button on `DikCokVideoCard` with a quick-amount picker ($5, $10, $25, $50, custom)
- Deduct from player's `cash` balance, credit to the video's band balance
- Show tip total and recent tippers on each video card
- Display "Top Tippers" leaderboard in the Analytics tab

#### 5. UI Updates
- Add a "Tips" stat card to the DikCok stats overview (next to Views, Hype, Revenue)
- Challenge tab: show active + recently ended challenges with winner highlights
- Version bump to 1.1.153

### Files to Create
- `supabase/migrations/xxx_weekly_challenges_tips.sql` -- schema changes + seed templates
- `src/hooks/useDikCokTips.ts` -- tip sending/receiving hooks
- `src/components/dikcok/DikCokTipButton.tsx` -- tip UI component

### Files to Modify
- `src/hooks/useDikCokChallenges.ts` -- add entry mutation, rotation check
- `src/components/dikcok/DikCokChallengeCard.tsx` -- wire enter button, show leaderboard
- `src/components/dikcok/DikCokVideoCard.tsx` -- add tip button + tip total display
- `src/pages/DikCok.tsx` -- add tips stat card, past challenges section
- `src/components/VersionHeader.tsx` -- bump to 1.1.153
- `src/pages/VersionHistory.tsx` -- document changes

### Economy Impact
- Fan tips act as a **cash sink** (players spend cash to tip) and **redistribution mechanism** (cash flows to successful creators)
- Challenge rewards inject controlled cash/fame bonuses weekly, incentivizing regular content creation

