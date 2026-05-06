
# MMO Expansion: Crafting + World + Social

A three-track rollout. Each track ships in 2 phases so you see playable progress fast and can course-correct between phases. Total: 6 phases, version bumps per phase.

---

## Track A — Crafting (Hybrid model)

Casual default loop, optional deep mastery for dedicated crafters.

### Phase A1 — Foundations & Luthiery (v1.1.288)
- New tables: `crafting_materials`, `crafting_blueprints`, `crafting_inventory`, `crafted_items`, `crafting_skills` (per-discipline mastery 0-1000).
- Materials sold in city shops (wood, pickups, electronics, fabric, vinyl blanks). Prices vary by city/region.
- Luthiery workbench page: pick blueprint → consume materials → roll stats (tone, durability, signature bonus) modified by mastery.
- 12 starter blueprints (3 guitar, 2 bass, 2 drum kit, 2 mic, 3 pedal). Drops: gigs, mentors, blind boxes.
- Crafted instruments hook into existing gear/equipment slots.

### Phase A2 — Studio Gear, Merch Design, Workshops (v1.1.289)
- Pedalboard/amp/mic-chain crafting → recording quality multiplier.
- Merch design studio: base item + artwork + materials → affects sell-through and margin in existing merch system.
- Player-run workshops: extend `subsidiaries` so a workshop can craft-on-commission for other players (set price, take orders).
- Mastery tiers (Apprentice → Journeyman → Master) unlock rare blueprints.

---

## Track B — World Interactivity (Tier-1 cities first)

Top 20 music cities get hand-curated landmarks; rest stay basic for now.

### Phase B1 — Landmarks & Busking (v1.1.290)
- New tables: `city_landmarks` (5 per Tier-1 city: record store, dive bar, rehearsal space, park, recording school), `landmark_visits`, `busking_sessions`.
- City detail page: clickable landmark map with mini-events per location (random encounters, blueprint drops, NPC intros, stat boosts).
- Busking: pick a busking spot → resolves with crowd-size based on skill × weather × foot-traffic × time-of-day → tips + small fame.
- Hooks into existing weather + regional fame systems.

### Phase B2 — Local Scene Rep & Recurring NPCs (v1.1.291)
- `city_scene_reputation` per character per city; unlocks hidden venues, after-hours jams, scene-only NPCs.
- `npc_relationships` upgraded with persistent memory: journalist, rival, superfan archetypes that re-appear with knowledge of past interactions.
- Surface dynamic weather as world events on the dashboard (heatwave festival, rainy-night acoustic).

---

## Track C — Social Overhaul

Fix the "complex and clunky" pain. Replaces scattered chat panels with a unified surface.

### Phase C1 — Unified Social Hub + Presence (v1.1.292)
- New `/social` route with three columns: Online friends, Activity feed, DMs. Persistent dock on desktop, full screen on mobile.
- One-click "Invite to…" actions on every friend row: jam, co-write, recording session, tour leg.
- Real-time presence in shared spaces: studio lobby, nightclub, festival backstage show live occupant lists with quick-actions (chat, gift, challenge, propose collab). Uses Supabase Realtime presence channels.
- Migrate existing chat panel widgets to consume Hub data; deprecate the old scattered panels (keep redirect).

### Phase C2 — Guilds / Crews (v1.1.293)
- New tables: `crews`, `crew_members`, `crew_chat`, `crew_resources` (shared cash pool, blueprint library, gig leads).
- Roles: Founder, Officer, Member. Permissions for spending pool / inviting / kicking.
- Crew quests: weekly objectives that pay out to the pool (e.g. "5 members play a gig this week", "release 3 songs").
- Crew page integrated into the Social Hub left nav.

---

## Cross-cutting

- **Version + history**: Bump banner version each phase, append entry to `VersionHistory.tsx`.
- **Memory**: Save 3 new memory files at end (crafting hybrid model, social hub architecture, tier-1 landmark scope).
- **TypeScript / RLS**: Follow existing project rules — `profile_id` for character logic, helper SECURITY DEFINER functions for cross-table joins, integer-cents for any pricing, explicit FK hints on PostgREST joins.
- **No breaking changes**: All new tables and routes are additive. Existing chat panels stay until C1 ships, then redirect.

---

## What ships first if you approve

I will start with **Phase A1 (Luthiery foundations)** — schema migration + workbench UI + 12 blueprints — because it's the most self-contained and unblocks A2/B1 drops. After it lands and you've tried it, I'll move to C1 (Social Hub) since that addresses your pain point most directly, then continue rotating through the tracks.

Reply "go" to start Phase A1, or tell me a different starting phase.
