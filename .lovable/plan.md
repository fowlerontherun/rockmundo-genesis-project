

## Social and Relationship Feature Review and Expansion Plan

### Current State

**Working features:**
- Friend requests (send/accept/decline/remove)
- Direct messaging between friends
- Send money to friends (cash transfer)
- Send gear/equipment to friends (inventory transfer)
- NPC relationship system (affinity, trust, respect)
- Character relationship network (trust, attraction, loyalty scores)
- Interaction modal with preset actions (chat, gift, collaborate, challenge, flirt, confront)
- Nightclub visits with stance system, DJ performances, drink purchasing, NPC quests, reputation tracking

**Missing or incomplete:**
1. **Player-to-player mentorship** -- `mentorshipProgression.ts` has calculation logic but no database table, no UI, and no way for players to offer/accept mentoring
2. **Skill teaching** -- No mechanism for one player to teach another a skill
3. **Nightclub socializing** -- No way to see/interact with other players at the same nightclub
4. **Item trading** -- The "Secure trade" dialog in ActionButtons.tsx is cosmetic (just records an event string, no actual item exchange)

### Plan (v1.1.152)

#### 1. Create `player_mentorships` database table
- Columns: `id`, `mentor_profile_id`, `mentee_profile_id`, `focus_skill`, `status` (pending/active/completed/cancelled), `created_at`, `updated_at`, `xp_granted`, `sessions_completed`
- RLS: both mentor and mentee can read; mentor can update; either can insert
- Uses profile-based ownership pattern (lookup via `profiles.user_id = auth.uid()`)

#### 2. Add mentorship UI to the Relationships page
- New section within the Friends detail panel: "Offer to Mentor" / "Request Mentorship" buttons
- Shows skill comparison between the two players (using existing skill data)
- Displays active mentorship status, synergy score (from `calculateMentorshipBonuses`), and session progress
- Mentor can "Run Session" to grant XP/skill boosts to mentee using the existing progression formulas

#### 3. Add nightclub social features
- New "Who's Here" section on the NightClubDetail page showing other players currently at the club (based on recent `player_club_reputation` visits within the last hour, or a lightweight `club_presence` table)
- Create `club_presence` table: `profile_id`, `club_id`, `entered_at`, auto-expires
- When a player enters a club (stance selection or drink purchase), record presence
- Show player cards with "Add Friend" / "Send Message" actions
- Add a club chat channel (reuse existing `chat_messages` infrastructure with channel = `club:{clubId}`)

#### 4. Make item trading functional
- Update the "Secure trade" flow in `ActionButtons.tsx` to actually allow selecting gear from inventory
- Add a gear picker (reuse the Select pattern from the money/gear gift section in Relationships.tsx)
- Execute the `player_equipment_inventory` transfer on confirmation (same pattern as `handleSendGearToFriend`)

#### 5. Version bump to 1.1.152

### Files to create
- `supabase/migrations/xxx_player_mentorships.sql` -- mentorship table + RLS
- `supabase/migrations/xxx_club_presence.sql` -- club presence table + RLS
- `src/hooks/usePlayerMentorship.ts` -- CRUD hooks for mentorships

### Files to modify
- `src/pages/Relationships.tsx` -- Add mentorship section in friend detail panel
- `src/pages/NightClubDetail.tsx` -- Add "Who's Here" player list and club chat
- `src/features/relationships/components/ActionButtons.tsx` -- Make trade dialog functional with gear picker
- `src/components/VersionHeader.tsx` -- Bump version
- `src/pages/VersionHistory.tsx` -- Document changes

