
# Complete Twaater System Review & Enhancement Plan

## Current State Analysis

### What's Working
- **35 total accounts** (17 active bots + 18 player accounts)
- **2,846 twaats** in the database
- **340 follows** between accounts
- Bot twaats are generating (last posts were ~30 minutes ago)
- AI-powered feed ranking using Gemini 2.5 Flash
- Like, reply, retwaat, bookmark functionality
- Trending topics and hashtags
- User profiles with follow/unfollow

### Key Issues Identified

**1. Feed Visibility Problem**
The main "Feed" tab uses `useTwaaterAIFeed` which:
- For logged-in users: Calls AI to rank posts but only shows posts from the last 7 days
- If a user follows nobody, the AI feed returns mostly bot content
- The fallback chronological feed also filters by `followedIds` - meaning you ONLY see posts from people you follow

**2. Not Enough NPC Accounts (17 bots)**
Current bot distribution is unbalanced:
| Bot Type | Count |
|----------|-------|
| industry_insider | 6 |
| music_fan | 4 |
| venue_owner | 3 |
| critic | 3 |
| influencer | 1 |

Missing bot types that would add variety:
- Record label accounts
- Radio station accounts
- Festival accounts
- Music journalist accounts
- Podcast host accounts
- Rising artist accounts (fake NPC artists)

**3. Follower Growth Not Happening**
Two edge functions handle follower growth:
- `calculate-organic-followers` - Adds bot followers based on fame/fans formula
- `bot-engagement` - Bots follow players based on fame probability

**Problem**: No evidence these are being triggered by cron jobs. The `cron_job_runs` table query returned empty for these functions.

**4. Missing "Explore" or "For You" Tab**
Users need a way to discover content from accounts they don't follow. Currently:
- Feed tab = only followed accounts
- Trending tab = only trending content (limited scope)
- No global "Explore" feed showing all public content

---

## Implementation Plan

### Part 1: Add "Explore" Feed Tab
Create a new tab that shows all public twaats regardless of follow status - a true discovery feed.

**Files to create/modify:**
- `src/hooks/useTwaaterExploreFeed.ts` (new) - Fetch public twaats with engagement ranking
- `src/components/twaater/TwaaterExploreFeed.tsx` (new) - Display explore content
- `src/pages/Twaater.tsx` - Add "Explore" tab between Feed and Search

**Explore feed logic:**
```text
1. Fetch all public twaats from last 14 days
2. Sort by engagement score: (likes * 1) + (replies * 2) + (retwaats * 3)
3. Boost verified accounts and high-fame accounts
4. Mix in variety of account types (bots + players)
5. Show 50 posts, refreshable
```

### Part 2: Add 15+ New Bot Accounts
Create diverse NPC accounts to make the platform feel alive.

**New bot types to add:**
| Handle | Display Name | Type | Personality |
|--------|--------------|------|-------------|
| @RockRadioFM | Rock Radio FM | radio_station | Plays classics, announces chart hits |
| @IndiePodcast | The Indie Hour | podcast_host | Interviews, album deep-dives |
| @SummerFestHQ | Summer Festival Official | festival | Lineup announcements, ticket hype |
| @RecordDealHQ | A&R Central | record_label | Talent scouting, signing news |
| @LiveNationNews | Live Nation Updates | tour_promoter | Tour announcements, ticket alerts |
| @MusicBlogger | Music Discovery Blog | blogger | New releases, reviews |
| @StudioSessions | Studio Life | studio | Behind-the-scenes, recording tips |
| @MerchDrop | Merch Collector | merch_collector | Band merch reviews, drops |
| @VinylHunter | Rare Vinyl Finds | collector | Vinyl collecting, rare finds |
| @ConcertPhotog | Concert Photography | photographer | Concert photos, backstage |
| @GuitarGuru | Guitar World | gear_reviewer | Gear reviews, tutorials |
| @DrummerLife | Drummer Daily | musician_fan | Drumming content, covers |
| @BassBoost | Bass Culture | musician_fan | Bass music, technique |
| @SynthWave | Synth Sounds | musician_fan | Synth music, production |
| @RisingStarAI | Rising Star (Bot Artist) | npc_artist | Fake artist posting about their music career |

**Files to modify:**
- Create migration to add new bot accounts to `twaater_bot_accounts` and `twaater_accounts`
- `supabase/functions/generate-bot-twaats/index.ts` - Add templates for new bot types

### Part 3: Fix Follower Growth with Admin Tools
The organic follower calculations exist but may not be triggered reliably.

**Create admin panel for manual trigger + monitoring:**
- `src/pages/admin/TwaaterAdmin.tsx` (new) - Admin dashboard for Twaater
  - Trigger `generate-bot-twaats` manually
  - Trigger `bot-engagement` manually  
  - Trigger `calculate-organic-followers` manually
  - View recent bot activity logs
  - See follower/engagement statistics
  - Add/manage bot accounts

**Add scheduled database triggers:**
- Create `pg_cron` schedule for `calculate-organic-followers` (every hour)
- Create `pg_cron` schedule for `bot-engagement` (every 30 mins)
- Create `pg_cron` schedule for `sync-twaater-fame` (every 6 hours)

### Part 4: Improve Feed Algorithm Fallback
When AI feed fails or is slow, the fallback should still show interesting content.

**Modify `useTwaaterFeed.ts`:**
- Change from "only followed accounts" to "followed + popular public posts"
- Add mixing logic: 70% from followed accounts, 30% from popular public accounts
- Ensure new users see content immediately, not empty feeds

### Part 5: Add "For You" Suggestions
Add inline suggestions in the feed to discover new accounts.

**Create `TwaaterFeedSuggestions.tsx`:**
- Show 3-5 suggested accounts to follow
- Appears after every 10 twaats in the feed
- Based on: Same genre interests, mutual follows, popular accounts

---

## Technical Details

### Database Changes (Migration)
```sql
-- Add new bot accounts
INSERT INTO twaater_accounts (id, handle, display_name, owner_type, verified)
VALUES 
  (uuid_generate_v4(), 'RockRadioFM', 'Rock Radio FM', 'bot', true),
  (uuid_generate_v4(), 'IndiePodcast', 'The Indie Hour', 'bot', true),
  -- ... more accounts

-- Link to bot_accounts table with personality
INSERT INTO twaater_bot_accounts (account_id, bot_type, personality_traits, posting_frequency)
SELECT id, 'radio_station', ARRAY['energetic', 'professional'], 'high'
FROM twaater_accounts WHERE handle = 'RockRadioFM';

-- Create cron schedules
SELECT cron.schedule(
  'twaater-organic-followers',
  '0 * * * *', -- Every hour
  $$SELECT net.http_post(
    url:='https://PROJECT_URL/functions/v1/calculate-organic-followers',
    headers:='{"Authorization": "Bearer SERVICE_KEY"}'::jsonb
  )$$
);
```

### New Edge Function Templates
Add to `generate-bot-twaats/index.ts`:
```typescript
const BOT_TEMPLATES = {
  // ... existing templates
  radio_station: {
    general: [
      "🎵 Now playing: {song} by {artist}! Call in and request your favorites!",
      "📻 Coming up at the top of the hour: Chart countdown!",
      "🔊 Listener's choice hour! What do you want to hear?",
    ],
    chart_comment: [
      "📊 {song} is climbing the charts! Week {week} at #{rank}",
      "🏆 New #1 alert! {artist} takes the top spot with {song}!",
    ],
  },
  festival: {
    general: [
      "🎪 Lineup announcement coming this week! Who should headline?",
      "🎫 Early bird tickets selling fast! Don't miss out!",
      "⛺ Festival season is almost here! Share your camping tips below",
    ],
  },
  // ... more types
}
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useTwaaterExploreFeed.ts` | Create | Fetch all public twaats for discovery |
| `src/components/twaater/TwaaterExploreFeed.tsx` | Create | Explore feed component |
| `src/components/twaater/TwaaterFeedSuggestions.tsx` | Create | Inline follow suggestions |
| `src/pages/Twaater.tsx` | Modify | Add Explore tab, integrate suggestions |
| `src/pages/admin/TwaaterAdmin.tsx` | Create | Admin controls for Twaater |
| `src/components/admin/AdminNav.tsx` | Modify | Add Twaater admin link |
| `src/App.tsx` | Modify | Add TwaaterAdmin route |
| `src/hooks/useTwaats.ts` | Modify | Improve fallback feed logic |
| `supabase/functions/generate-bot-twaats/index.ts` | Modify | Add new bot type templates |
| `supabase/migrations/xxx_add_twaater_bots.sql` | Create | Add 15 new bot accounts + cron schedules |
| `src/components/VersionHeader.tsx` | Modify | Bump to v1.0.535 |
| `src/pages/VersionHistory.tsx` | Modify | Add changelog |

---

## Expected Outcomes

1. **New users see content immediately** via Explore tab (no follows required)
2. **Feed feels alive** with 30+ diverse NPC accounts posting regularly
3. **Followers grow organically** as players gain fame/fans
4. **Admins can monitor and trigger** Twaater systems manually
5. **Discovery is easy** with inline suggestions and explore feed
