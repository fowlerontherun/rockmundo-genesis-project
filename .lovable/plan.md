
## Goal

Collapse the overlapping `/relationships`, `/social` (tile hub), and `/players/search` surfaces into a single **Social** destination that feels Popmundo-simple: find a player → friend them → talk, meet, invite, gift, marry, raise kids — all in one place, with realtime chat and voice already wired in.

## Current state (what we're consolidating)

- `/social` (`src/pages/SocialHub.tsx`) — just a 6‑tile launcher (Twaater, DikCok, Relationships, Gettit, Player Search, Underworld).
- `/relationships` (`src/pages/Relationships.tsx`, 1670 lines) — the real engine: friendships, character relationships, interactions, drama, gifts, mentorship, embedded `FamilyDashboard`, coop quests, leaderboards.
- `/players/search` (`PlayerSearch.tsx`) + `/player/:id` (`PlayerProfile.tsx`) — standalone discovery.
- `src/features/relationships/` already has: `FriendshipList`, `FriendSearchDialog`, `DirectMessagePanel`, `FriendGiftDialog`, `FriendActivityFeed`, `Timeline`, hooks (`useFriendships`, `useRelationshipEvents`).
- `src/components/family/` has the full marriage/children stack (Proposal, Wedding, Honeymoon, Birth, ChildCard, ComingOfAge, MarriageStatusCard…). `family/timeline` and `family/child/:id` stay as deep-link pages.
- `JamSessionsEnhanced` already exposes voice via `JamVoiceChat` (see `FestivalVoiceChat.tsx`), and `useJamSessionChat.ts` is the proven realtime-chat + presence pattern we'll reuse.
- Gifting today: `FriendGiftDialog` (money / gear). No underworld-items gifting yet.
- Invites today: none for gigs / recording / jams / songwriting from a friend context. Each system has its own page.

## Target design

One page at `/social` (Relationships becomes a redirect). Mobile-first, high‑density, tab‑driven — matches our existing UI density rules.

```text
┌─ Social ────────────────────────────────────────────┐
│ [ Friends | Chat | Family | Feed | Discover ]       │
├─────────────────────────────────────────────────────┤
│ Friends:  search bar → add friend                   │
│   • Friend row → opens FriendDetailPanel with:      │
│     Chat · Voice · Gift · Invite ▾ · Meet up ▾      │
│     Relationship gauges (affection/trust/…)         │
│     Family link (if married / parent / sibling)     │
├─────────────────────────────────────────────────────┤
│ Chat: realtime DM threads + voice-call button       │
│ Family: existing FamilyDashboard (marriage, kids)   │
│ Feed: FriendActivityFeed + drama events             │
│ Discover: PlayerSearch results + suggested players  │
└─────────────────────────────────────────────────────┘
```

### Friend action menu (per friend, Popmundo-style)

- **Chat** — opens realtime DM thread (existing `DirectMessagePanel`, upgraded to Supabase Realtime using the `useJamSessionChat` pattern).
- **Voice** — 1‑to‑1 voice room using `JamVoiceChat` with `sessionId = dm-voice-<friendshipId>`.
- **Gift ▾** — Money · Gear (from `useEquipmentStore`) · **Underworld item** (new — pulls from the player's underworld inventory).
- **Invite ▾** — to **Gig** (own scheduled gig), **Recording session**, **Jam session**, **Songwriting session**.
- **Meet up ▾** — Casual meetup · **Date** (romance flag) · Choose venue from current city.
- **Relationship actions** — existing interaction presets (flirt, collab, confront, support…).
- **Family** — if relationship is `partner` and both single → "Propose" (`ProposalDialog`); if married → quick link to Family tab; if shared child → child shortcuts.

## Implementation plan

### 1. New unified page

- Rename `src/pages/SocialHub.tsx` → `SocialHubUnified` (single component). Drop the 6‑tile launcher.
- Lift the working content out of `Relationships.tsx` into smaller tab components under `src/features/social-hub/`:
  - `FriendsTab.tsx` (search + list + detail drawer)
  - `ChatTab.tsx` (DM threads + voice)
  - `FamilyTab.tsx` (wraps `FamilyDashboard`, surfaces marriage/children CTAs)
  - `FeedTab.tsx` (activity + drama + weekly recap)
  - `DiscoverTab.tsx` (player search + suggestions, replaces `/players/search` UX inside the hub)
- Routes: `/social` = new hub. `/relationships` → `<Navigate to="/social" replace>`. `/players/search` → redirect to `/social?tab=discover`. Keep `/player/:id` as profile page. Keep deep `family/*` routes.
- Update `WorldSocialHub.tsx` tile group so "Social Hub", "Relationships", "Player Search" collapse into one "Social" tile.

### 2. Realtime chat (DMs)

- New table `direct_messages` (channel_id, sender_profile_id, body, created_at) with RLS limiting to the two friend profiles. `channel_id = sorted pair of profile ids`.
- New `useDirectMessages(friendshipId)` hook modelled on `useJamSessionChat`: query + Realtime `postgres_changes` subscription + presence channel for typing/online.
- Rewire `DirectMessagePanel` to use it; add unread badges on friend rows.

### 3. Voice chat (1:1)

- Reuse `JamVoiceChat` via a thin wrapper `DirectVoiceChat` with `sessionId = dm-voice-<channelId>`. No new infra.
- Voice button on friend row + inside chat thread.

### 4. Invites system

- New table `social_invites` (id, from_profile_id, to_profile_id, kind: `gig|recording|jam|songwriting|meetup|date`, ref_id nullable, scheduled_at, location_city_id, status: `pending|accepted|declined|expired`, message).
- New `InviteDialog` with kind switcher. For each kind, fetch eligible refs:
  - **Gig** → caller's upcoming `gigs` they own.
  - **Recording** → bookable `recording_sessions` slots.
  - **Jam** → existing jam session or "create + invite".
  - **Songwriting** → active songwriting projects where caller can add collaborators.
- Inbox surface: invites land in existing `/inbox` and as a badge on the friend row. Accepting writes the appropriate join row (gig attendee, jam participant, songwriting collaborator) and logs a relationship interaction (+trust/+affection).

### 5. Meet ups & dates

- Special `kind = meetup|date` invite. On accept, both characters' `Schedule` gets a blocked slot (uses the existing universal activity-blocking pattern from memory). Date completion triggers `flirt`/`deep_conversation` interaction preset and feeds `attraction_score`.

### 6. Gifting — extend `FriendGiftDialog`

- Add a third tab: **Underworld item**. Pull from the caller's underworld inventory (`underworld_inventory` style table — confirm exact name during implementation). Transfer = decrement caller, insert into recipient, log interaction `gift` (+affection +loyalty), notify recipient. Money + Gear paths already work.

### 7. Family linkage

- In `FriendDetailPanel`, compute relationship-to-family state from existing `useWeddings`, `useChildPlanning`, marriage/spouse rows and show contextual CTAs:
  - Single + romance partner → **Propose** (`ProposalDialog`)
  - Engaged → **Plan wedding** (`WeddingPlannerDialog`)
  - Married → **Honeymoon**, **Plan child** (`ChildPlanningDialog`), **Open Family**
  - Co‑parent → list shared children with link to `/family/child/:id`
- Friend row badges: 💍 spouse, 👶 co‑parent, 👨‍👩‍👧 family.

### 8. Cleanup / redirects

- Delete the old tile-only `SocialHub.tsx` body (keep filename as the unified page, since `App.tsx` already imports it as `SocialHubUnified`).
- Remove duplicate "Social Hub" + "Relationships" + "Player Search" tiles from `WorldSocialHub.tsx`.
- Keep `Relationships.tsx` only long enough to migrate its logic into tab files, then delete it and add the redirect.

### 9. Version + history (per project rule)

- Bump `VersionHeader.tsx` (next patch).
- Add a `VersionHistory.tsx` entry describing the merger, realtime DMs, 1:1 voice, invites, underworld gifting, and family CTAs.

## Database changes (single migration)

- `direct_messages` table + RLS (only the two friends can read/insert; only sender can update/delete own).
- `social_invites` table + RLS (only sender and recipient see it; recipient can update `status`).
- Index `direct_messages(channel_id, created_at)` and `social_invites(to_profile_id, status)`.
- Enable Realtime replication on both tables.

## Out of scope (explicit)

- Twaater, DikCok, Gettit, Underworld, Casino stay on their own routes (the user only asked to merge Relationships + Social Hub launcher). Their tiles remain in `WorldSocialHub`.
- No changes to the gigs/recording/songwriting/jam business logic — only the invite entry points are new.

## Open questions

1. For **underworld-item gifts** — restrict to legal-grey items only, or allow anything in the player's underworld inventory (with reputation consequences logged via existing roleplaying axes)?
2. **Voice chat scope** — 1:1 only, or also small group calls from a friend group? (Default plan: 1:1 only.)
3. **Date mechanic** — should a successful date have a chance to advance romance to `partner` automatically once attraction ≥ threshold, or always require an explicit "Ask to be partner" action?
