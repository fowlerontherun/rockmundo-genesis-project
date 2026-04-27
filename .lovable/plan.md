## Goals

Three connected pieces:

1. **Fix notifications** — players never see in‑game notifications because the bell reads from an empty in‑memory context that nothing writes to.
2. **Premium Store tile/hub** — a single discoverable entry point for buying premium things (VIP, extra character slots, skin store).
3. **Adoption + Parenting loop** — extend the existing biological children system with adoption, and design a recurring parenting game loop.

---

## 1. Fix notifications

**What's broken today**
- `NotificationProvider` (in‑memory) is mounted in `App.tsx` and the `NotificationBell` reads from it, but **nothing in the app calls `addNotification`**.
- `useGameNotifications` / `useGigNotifications` exist but are never imported (already flagged as dead code in version history).
- Real notification data already lives in DB tables: `band_gift_notifications`, `company_notifications`, `sponsorship_notifications`, `twaater_notifications`, plus inferable signals from `gigs`, `releases`, `child_requests`, `vip_subscriptions`, etc.

**Plan**
- Create one unified `notifications` table (id, user_id, profile_id, category, type, title, message, action_path, metadata jsonb, read_at, created_at) with RLS scoped to the owning user/profile, and add it to the `supabase_realtime` publication.
- Add a `useNotifications` hook backed by React Query + a realtime channel that:
  - Loads the latest 50 notifications for the active profile.
  - Subscribes to inserts/updates and invalidates the query.
  - Exposes `markRead`, `markAllRead`, `dismiss`, `clearAll`.
- Rewrite `NotificationBell` to use the new hook. Keep the existing in-memory `NotificationContext` only as an ephemeral toast surface (or remove it entirely — TBD during implementation; safer to keep and have it fall through to the new hook).
- Backfill **producers** so bells actually populate:
  - DB triggers / edge cron writing to `notifications` for: upcoming gigs (24h), release manufacturing complete, release day, band gift received, sponsorship offer, label contract offer, co‑op quest claimed, marriage proposal, child request response, VIP expiring, character death, etc.
  - Where a dedicated table already exists (twaater, company, sponsorship, band gift) add an AFTER INSERT trigger that mirrors a row into `notifications` with the right `action_path`.
- Wire the existing dead `useGameNotifications` hook to write into the new table instead of `toast`, and mount it once at the layout level.
- Add a `NotificationsPage` at `/inbox/notifications` (or extend the existing Inbox) for a full history view with filters (All / Unread / by category).

**Acceptance**: triggering a band gift, a co-op quest claim, or a 24h-out gig produces a bell badge + a row in the dropdown, persists across reloads, and updates live without refresh.

---

## 2. Premium Store tile + hub

**Today**
- Routes `/vip-subscribe`, `/buy-character-slot`, `/skin-store` exist but are only reachable from scattered cards (e.g. `VipStatusCard`, `CharacterHub` for skins). There is no single "buy real‑money / premium things" surface.

**Plan**
- Add a new `PremiumStoreHub` page at `/premium-store` using the existing `CategoryHub` component, with tiles:
  - **VIP Membership** → `/vip-subscribe` (Crown icon).
  - **Character Slots** → `/buy-character-slot` (UserPlus icon) — shows current `character_slots.max_slots` vs used.
  - **Skin Store** → `/skin-store` (Shirt icon) — already exists, just surfaced here.
  - **Cosmetics & Boosts** (placeholder for future SKUs) → disabled tile with "Coming soon".
- Add a top-level "Premium" tile to a discoverable hub. Two options to confirm with the user during implementation:
  - (a) Add it to `CharacterHub` (most natural — it's about *your* account).
  - (b) Promote it to the main bottom/horizontal navigation with a small Crown badge.
  - Default unless told otherwise: do **(a)** plus a persistent small "Premium" link in `HorizontalNavigation` next to the notification bell, gated to non‑VIP users primarily but always visible.
- Reuse `VipBadge` styling and the existing translation keys (`nav.skinStore`, etc.); add `nav.premiumStore` and `nav.characterSlots` translations.
- The hub is purely navigational — no new payment code; checkout already lives on the destination pages.

**Acceptance**: from any screen, a player can reach VIP, slots, and skins in ≤2 taps via a clearly branded "Premium" entry.

---

## 3. Adoption + parenting game loop

**Existing foundation (already in DB)**
- `marriages`, `child_requests` (with `gestation_ends_at`, `upbringing_focus`, `surname_policy`), `player_children` (with `bond_parent_a/b`, `emotional_stability`, `current_age`, `playability_state`, `inherited_potentials`, `traits`).
- Hook `useChildPlanning.ts` already manages biological child requests.

**Design — Adoption**
- Add adoption as a second pathway into `child_requests`:
  - New column `pathway text not null default 'biological'` with values `biological | adoption`.
  - Adoption-specific columns: `agency text` (e.g. local/international), `application_fee_cents int`, `home_study_status text`, `match_age_min int`, `match_age_max int`.
  - Adoption skips `gestation_ends_at`; instead uses `home_study_complete_at` + `match_ready_at` timestamps.
- Eligibility: requires either an active `marriage` **or** single-parent flag (`single_parent_allowed boolean default true` on the request) — confirm during build whether single-parent adoption should be allowed (default: yes).
- Flow:
  1. Player opens "Family" tab on Relationships hub → "Adopt a child".
  2. Pays application fee (cash gated), picks agency tier (cheap/local → expensive/international, affecting wait time and trait pool).
  3. Edge function/trigger schedules `home_study_complete_at` (e.g. 3 in-game days) → notification.
  4. After home study, `match_ready_at` (1-2 in-game days) → child appears in `player_children` with randomized traits/age in the chosen range and starting bond values lower than biological (e.g. 20 vs 50) representing a slower attachment curve.
- All progression milestones write to the new `notifications` table.

**Design — Parenting loop**
- Extend `player_children` with parenting-state columns:
  - `last_interaction_at timestamptz`, `mood int`, `needs jsonb` (food/sleep/affection/learning), `school_stage text`, `weekly_allowance_cents int`, `discipline_style text`.
- Add `child_interactions` table (id, child_id, actor_user_id, interaction_type, outcome jsonb, created_at, energy_cost) — types: `play`, `teach_skill`, `talk`, `discipline`, `outing`, `gift`, `attend_event`, `delegate_to_partner`.
- Daily/weekly tick (extend an existing scheduler):
  - Ages child in game-time using the established 1y = 120 days scale.
  - Decays `mood` and increases unmet `needs` if no interaction in N hours.
  - Applies `upbringing_focus` and recent `child_interactions` to slowly grow `inherited_potentials` and `traits` until `playability_state` becomes `playable` at the configured age (e.g. 16 in-game years).
- Outcomes feed the existing legacy/heir system: when the child becomes playable they appear as a selectable character slot using the existing multi‑slot/permadeath system, with stats inherited from `inherited_potentials` and parenting outcomes.
- Random events (using the existing random‑events framework): "Child got sick", "Parent‑teacher meeting", "First gig invite as a band kid" — each shows up in the new notifications feed with action buttons that open the parenting screen.
- New page `/family/children/:id` with: status header (age, mood, bond bars), needs meters, action buttons (Play / Teach / Talk / Outing / Gift), interaction history, growth chart of potentials.
- Co-parent integration: `controller_user_id` on `player_children` decides whose action queue it appears in; either parent can act, with bond effects favouring the actor.

**Phasing**
- **Phase 1 (this round)**: schema + adoption request flow + read-only child detail page + notifications integration.
- **Phase 2**: full parenting loop (interactions table, daily tick, random events, page actions).
- **Phase 3**: child becomes playable character & inherits stats into a character slot.

This plan only commits to Phase 1 implementation in code; Phases 2–3 are designed here so we don't paint ourselves into a corner with the schema.

---

## Technical Section

**Migrations (Phase 1)**
- `notifications` table + RLS + realtime publication + indexes on `(profile_id, created_at desc)` and `(profile_id, read_at)`.
- AFTER INSERT triggers mirroring rows from `band_gift_notifications`, `company_notifications`, `sponsorship_notifications`, `twaater_notifications`, `child_requests` (status changes), `vip_subscriptions` (expiring soon), `coop_quest_events` (claimed) into `notifications`.
- `child_requests`: add `pathway`, `agency`, `application_fee_cents`, `home_study_complete_at`, `match_ready_at`, `single_parent_allowed`.
- `player_children`: add `last_interaction_at`, `mood`, `needs`, `school_stage`, `weekly_allowance_cents`, `discipline_style` (Phase 1 nullable; used in Phase 2).

**Frontend (Phase 1)**
- New: `src/hooks/useNotificationsFeed.ts`, `src/pages/PremiumStoreHub.tsx`, `src/pages/family/AdoptChild.tsx`, `src/pages/family/ChildDetail.tsx`.
- Modified: `NotificationBell`, `HorizontalNavigation` (Premium link), `CharacterHub` (Premium tile), `useChildPlanning.ts` (split into `useBiologicalChildRequest` + `useAdoptionRequest`), `App.tsx` (new routes), `i18n` keys.

**Edge functions**
- `process-adoption-tick` (cron-style, runs hourly): advances `home_study_complete_at` / `match_ready_at`, creates `player_children` rows on match, writes notifications.
- (Phase 2) `process-parenting-tick`: daily decay + aging.

**Out of scope**
- Real-money payments for parenting — parenting actions cost in-game cash/energy only. VIP/slots continue using the existing Stripe flow on their own pages.

**Versioning**
- Bump version, update Version History with: "Notifications wired to live DB feed", "Premium Store hub added", "Adoption pathway + parenting schema scaffolded".
