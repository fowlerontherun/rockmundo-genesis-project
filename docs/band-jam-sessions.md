# Band Jam Sessions 2.0

This document redesigns the band jam session feature inspired by Popmundo while modernizing the structure for Rockmundo Genesis. It lists targeted improvements, data structures, and mechanics including a small random chance to receive a gifted song out of a jam session.

## Design Goals
- Make jam sessions a social event that still respects asynchronous play.
- Surface actionable feedback each slot so bands can iteratively improve.
- Tie jams into the broader ecosystem (studios, gigs, talent scouting, charts).
- Allow casual onboarding while supporting high-end optimization.

## Baseline Summary
Popmundo jam sessions let bands rehearse songs together to raise familiarity and performance levels. They are mostly text-driven, relatively low on interactivity, and lack persistent shared spaces or rewards beyond skill gain. The redesign keeps the collaborative spirit but adds depth, pacing, and reward hooks.

## Key Improvements (20 total)
1. **Live Jam Lobby** – Instance-based room where members (and invited friends) can drop in/out asynchronously; runs on a timeline that persists even if players log off.
2. **Spectator Slots** – Fans and talent scouts can watch jams via read-only presence to generate buzz.
3. **Dynamic Setlists** – Curate setlists by theme or mood, with automated suggestions based on band genre affinity.
4. **Skill Synergy Bonuses** – Combination of complementary skills (e.g., Stage Presence + Groove) unlocks temporary buffs.
5. **Session Roles** – Assign producer, sound tech, roadie roles with unique mini-actions each slot.
6. **Mood Meter** – Replaces static “energy” with a band mood bar influenced by player choices and environment.
7. **Venue Traits** – Jam venues have acoustics, amenities, and ambiance values that alter outcomes.
8. **Session Challenges** – Optional daily modifiers (e.g., "Play unplugged") that reward bonus XP/cred.
9. **Progressive Unlocks** – New jams unlock instrument drills, vocal warmups, or improvisation tracks as bands improve.
10. **Shared Crafting Queue** – Bands collectively craft arrangements or backing tracks during downtime.
11. **Recording Snippets** – Automatically captures highlight clips that can be reused in marketing or as collectibles.
12. **Band Diary Feed** – Auto-generates recap posts with stats, quotes, and photos for the band's timeline.
13. **NPC Cameos** – Famous NPCs can randomly join as guest mentors adding unique buffs.
14. **Reputation Arcs** – Jam performance contributes to citywide reputation tiers unlocking venue access.
15. **Fan Engagement Polls** – Spectators vote on encore demands, affecting future setlist suggestions.
16. **Session Economy** – Introduces jam tickets, refreshment costs, and merch pop-ups for monetization loops.
17. **Health & Fatigue Tracker** – Individual fatigue thresholds that trigger rest recommendations or penalties.
18. **Analytics Dashboard** – Detailed metrics on accuracy, timing, synergy, and song mastery displayed after each slot.
19. **Jam Contracts** – Bands can sign limited-time jam residencies with venues offering progression milestones.
20. **Gifted Song Drops** – A rare chance (0.75% base rate) that a fully-written demo song is gifted to the band post-session.

## Session Flow
1. **Schedule & Setup**
   - Pick venue, duration (1–3 hours real-time equivalent, processed in slots), challenge modifiers, and session roles.
   - Populate a dynamic setlist (max 6 tracks) from owned songs or improvisation prompts.
   - Invite members, session artists, mentors, and optional spectators.
2. **Slot Resolution**
   - Each 10-minute slot processes:
     - Player choices (e.g., "improv solo", "tighten rhythm", "hype crowd").
     - Mood meter deltas, fatigue impacts, and synergy calculations.
     - Venue trait interactions.
     - Mini-events (NPC cameo, challenge completion).
   - Output summary card with actionable insights and updated analytics.
3. **Session End**
   - Aggregate stats, apply progression rewards, roll for gifted song drop, and publish band diary entry.

## Mechanics Overview

### Mood & Synergy
- Mood ranges from 0–100 and applies a ±15% modifier to performance scores.
- Positive mood events (fan polls, successful solos) push mood up; fatigue, failed challenges push it down.
- Skill synergies evaluate the mix of player skills in real-time, adding stacking buffs (max +25%).

### Fatigue & Health
- Every slot adds fatigue based on chosen actions; exceeding thresholds reduces output by 20% and can trigger recommended rest events.
- Rested players recover faster between sessions and unlock special improvisation prompts.

### Reputation & Progression
- Reputation arcs track cumulative jam ratings per city. Each tier unlocks new venues, NPC mentors, and exclusive challenges.
- Jam contracts define goals (e.g., achieve 3 consecutive "Great" ratings) and pay out credits, merch boosts, or venue cosmetics.

### Rewards
- Standard rewards: skill XP, reputation points, setlist arrangement progress, and highlight snippets.
- **Gifted Song Drop**: After final slot resolution, roll `gift_roll`:
  ```
  base_rate = 0.0075
  modifier = min(0.005, (band_mood / 400) + (reputation_tier * 0.001))
  chance = base_rate + modifier
  if random() < chance:
      grant_new_song(band_id, rarity=determine_rarity())
  ```
  - Gifted songs arrive as demo-quality tracks requiring studio polishing.
  - Rarity influences genre alignment, lyrical depth, and chart potential.
  - A band can only receive one gifted song per week to maintain scarcity.

## Data Model
- `jam_sessions`
  - `id`, `band_id`, `venue_id`, `scheduled_at`, `duration_slots`, `challenge_id`, `mood_start`, `mood_end`, `fatigue_snapshot`, `gifted_song_id`
- `jam_session_slots`
  - `id`, `session_id`, `slot_index`, `status`, `mood_delta`, `fatigue_delta`, `synergy_score`, `events_json`
- `jam_session_participants`
  - `id`, `session_id`, `character_id`, `role`, `fatigue_level`, `performance_score`
- `jam_session_setlists`
  - `id`, `session_id`, `song_id`, `order`, `focus_action`
- `jam_session_highlights`
  - `id`, `session_id`, `slot_index`, `media_url`, `engagement_score`
- `jam_contracts`
  - `id`, `band_id`, `venue_id`, `start_date`, `end_date`, `milestones_json`, `status`

## Systems Integration
- **Studios**: Gifted songs flag studio tasks to polish demos into release-ready tracks.
- **Gigs**: Higher jam ratings raise gig demand multipliers and unlock encore requests tied to fan polls.
- **Record Labels**: Labels track jam analytics to scout bands; jam contracts can be prerequisites for signing deals.
- **Nightlife**: Venues with nightlife features can cross-promote, affecting mood and fan attendance.

## Live Ops & Tuning
- Weekly rotational challenges keep jam modifiers fresh.
- Seasonal NPC mentors with unique buffs encourage returning engagement.
- Limited-time cosmetic drops (venue skins, merch styles) tied to jam contract completion.
- Analytics inform balancing of fatigue penalties, gift rates, and venue traits over time.

## Future Extensions
- Cooperative cross-band jams for festivals.
- Integration with user-generated content tools for highlight editing.
- Jam replay viewer allowing asynchronous commentary.

