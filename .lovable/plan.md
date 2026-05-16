# Friendship + Romance + Children expansion

## What's already there (do not rebuild)

- **Friendship**: `friendships` table + full UI suite under `src/features/relationships/` (search, list, DM, activity feed, leaderboard, weekly recap, co-op quests, streaks, teach dialog, tier perks).
- **Character relationships**: `character_relationships` with affection/trust/attraction/loyalty/jealousy scores and decay.
- **Romance**: `romantic_relationships` + `romantic_events` with stages flirting → dating → exclusive → public → engaged → married, plus secret-affair/jealousy math.
- **Marriage**: `marriages` (proposed→accepted→active→separated→divorced), `ProposalDialog` (optional wedding date only), `MarriageStatusCard`, divorce flow.
- **Children**: `child_requests`, `player_children`, `child_interactions`, `child_school_events`, trait catalog + synergies, age progression hook, coming-of-age dialog (heir becomes playable at 18).

## What's missing and will be added

### 1. Friendship — depth additions (small but visible)

- **Gift system**: new `friend_gifts` table. Send cash/merch/concert-ticket gifts to a friend; cost deducted, affection bumps, log to `relationship_events`, weekly cap to prevent grinding.
- **Friendship milestones**: triggered rows in `friendship_milestones` (best friends 30d, 100 interactions, 1y anniversary). Each emits an inbox entry and a small fame/morale boost. Surfaced in `BestFriendsLeaderboard` and friend detail panel.
- **Group hangouts**: pick 2–4 friends, schedule a "hangout" activity (uses existing `player_scheduled_activities`, blocks the timeslot). Boosts affection for everyone in the group; small chance of a drama event in `social_drama_feed`.
- **Friend triangle / jealousy hook**: if you hang out heavily with one friend while ignoring another high-affection friend, jealousy on the ignored side ticks up via the existing emotional engine. No new tables — reuses `character_relationships.jealousy_score`.

### 2. Romance → Engagement → Wedding → Honeymoon flow

**Schema (migrations):**

- Extend `marriages`:
  - `engagement_started_at timestamptz`, `engagement_ring_cost_cents bigint`, `engagement_announced boolean`
  - `wedding_id uuid` (FK to new `weddings`)
  - `honeymoon_id uuid` (FK to new `honeymoons`)
  - `last_anniversary_at timestamptz`, `anniversary_count int`
- New `weddings` table: `marriage_id`, `venue_city_id`, `venue_name`, `tier (courthouse|small|medium|grand|legendary)`, `guest_count`, `cost_cents`, `theme`, `ceremony_at`, `status (planned|completed|cancelled)`, `actual_attendance`, `fame_gained`, `media_buzz`, `photos_jsonb`, `vows_a`, `vows_b`.
- New `wedding_guests` table: `wedding_id`, `guest_profile_id` (or `guest_npc_id`), `rsvp_status`, `relationship_to_couple`, `gift_cents`.
- New `honeymoons` table: `marriage_id`, `destination_city_id`, `package_tier (budget|standard|luxury|world_tour)`, `duration_days`, `cost_cents`, `starts_at`, `ends_at`, `status`, `bond_gained`, `health_gained`, `fame_gained`.

**Flow:**

1. **Engagement**: romance must reach the `engaged` stage in `romantic_relationships` before `ProposalDialog` is allowed. Proposing now creates a `marriages` row with `status='engaged'` and `engagement_started_at=now()`. Engagement length is configurable (default 30 game-days minimum, 365 max). Either partner can cancel during engagement → `status='engagement_broken'` with affection/loyalty hits.
2. **Wedding planner** (new component `WeddingPlannerDialog`): pick venue tier, guest count, theme, ceremony date (must be ≥ engagement min). Cost preview based on tier × guest count. Guest list pulls from `friendships` + family. Creates `weddings` row with `status='planned'` and schedules a `player_scheduled_activities` block on ceremony day for both partners.
3. **Wedding ceremony**: new edge function `complete-wedding` (run by the existing daily process-scheduled-activities cron or on-demand at ceremony time). Computes:
   - Fame boost to both partners (tier-scaled, plus guest-RSVP %)
   - Cash deducted, paid to city economy
   - Inbox + activity feed entry, photos auto-generated stub (URL list in `weddings.photos_jsonb`)
   - Marriage flips to `status='active'`, both partners' `romantic_relationships.stage` → `married`
4. **Honeymoon planner** (`HoneymoonDialog`): opens automatically post-wedding. Pick destination city + package tier (budget/standard/luxury/world_tour) + duration (3–14 game days). Cost paid up-front. Creates `honeymoons` row, schedules blocking activity rows for both partners for the full duration; travel system auto-routes both to the destination city.
5. **Honeymoon completion**: `complete-honeymoon` edge function. Both partners gain health (+20 to +40), energy refill, romance attraction/loyalty/affection bump (tier-scaled), small fame for celebrity sightings. Sets `marriages.last_anniversary_at = now() + 1y`.
6. **Anniversaries**: yearly cron picks marriages where `last_anniversary_at + 1y < now()`. Posts inbox to both partners, +affection/loyalty, suggests "Vow renewal" (optional second wedding at reduced cost).
7. **NPC partners**: where the partner is an NPC (not a profile), all the above still runs — guest list draws from NPC contacts and the partner auto-RSVPs.

### 3. Children — finish the loop

Current gaps to close:

- **Auto-birth**: today `gestation_ends_at` just sits in the DB; the player must visit the family page to see "ready". Add a daily cron that fires the birth automatically once gestation ends and posts an inbox to both parents. The `BirthCompletionDialog` becomes a celebratory naming dialog instead of the trigger.
- **Birth inbox + activity feed**: standardised system inbox entry ("👶 Your child has arrived — name them") with deep-link to the family page.
- **Child age progression cron**: a daily edge function `progress-child-ages` that walks `player_children`, recomputes age from `birth_game_date`, fires stage-change inbox entries ("Lila is starting primary school"), and creates `child_school_events` automatically.
- **Recurring child costs**: monthly auto-deduction (school fees by stage, hobbies by interaction history). Skipping = lower bond + emotional_stability. Adds to city economy ledger.
- **Child illness / random events**: low-rate roll inside the age-progression cron creates an event in `child_school_events` (sickness, school prize, friend trouble) with a 24h response window; ignoring impacts bond.
- **Parent-to-child fame bleed**: when a parent gains fame, child inherits ~5% to a `child_fame` field on `player_children` (already there as inherited_potentials? check & add column if missing). Surfaces on child card.
- **Coming-of-age polish**: existing dialog stays. Add a one-time "Heir activated" inbox + activity feed post and a permanent +1 slot bonus on `character_slots` so playing an heir doesn't consume a normal slot.

### 4. UI surface

- **Family page** (`FamilyDashboard`) gains a new section ordering: Marriage status (now showing engagement timer, wedding plan card, honeymoon countdown) → Children → Family Legacy.
- **Romance panel** (`RomanticProgressionPanel`) gains an "Propose engagement" button once stage = public_relationship, and links to the wedding planner once engaged.
- **Relationships page** (`/relationships`) gets a Gifts tab and a Hangouts tab alongside existing Friends.
- Visible countdowns for: engagement length, days until ceremony, honeymoon end, gestation end, next anniversary.

### 5. Edge functions (new)

- `complete-wedding` — ceremony resolution
- `complete-honeymoon` — return-from-honeymoon resolution
- `progress-child-ages` — daily age/stage/events/costs
- `auto-complete-births` — fires when gestation ends
- `process-anniversaries` — yearly anniversary trigger

All scheduled via existing `pg_cron`/`pg_net` pattern (separate `insert` calls, not migrations).

### 6. Inbox + memory

- Every new system milestone (engagement, ceremony, honeymoon end, anniversary, birth ready, stage change) routes through the new `generate-system-inbox` profile-tagged pattern from v1.1.313 so multi-character players only see their own family events.

## Technical notes (for reference)

- All character-scoped writes use `profile_id`, never `user_id`, per the data-isolation memory.
- All cents-denominated fields go through `Math.round(dollars * 100)` to avoid INT4/22P02 errors.
- Wedding/honeymoon/birth all create `player_scheduled_activities` rows so the universal conflict checker blocks rehearsals/gigs/jobs during them.
- Bandmate RSVPs reuse `band_members.profile_id` for attendance lookups.
- Romance/marriage stage transitions trigger `relationship_events` rows for the timeline.
- Version bumps to 1.1.315 (friendship + scaffolding), 1.1.316 (wedding/honeymoon), 1.1.317 (children completion). Each bump updates `VersionHeader.tsx` and `VersionHistory.tsx` per project rule.

## Suggested build order

1. Schema migrations (marriages extensions + new weddings/honeymoons/wedding_guests/friend_gifts/friendship_milestones tables + RLS).
2. Engagement state, gift system, milestones, hangouts — small frontend additions on existing pages.
3. Wedding planner + edge function + UI surfaces on Family page.
4. Honeymoon planner + edge function.
5. Child auto-birth + age-progression + costs/events cron.
6. Anniversary cron + vow renewal flow.

Each step ships its own version bump and is independently testable.
