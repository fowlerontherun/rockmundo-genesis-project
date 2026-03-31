

# Remaining Plans and Docs: Priority Review

## Summary of All Plan Documents

After reviewing all 20+ docs and cross-referencing with the codebase, here is the status of each planned system:

### Already Implemented (docs are historical reference)
- **Marriage & Children** — Fully shipped (Phase 1 + 2, family dashboard, child planning, inheritance)
- **Night Clubs System** — Implemented (guest actions, DJ slots, quests, NPC dialogue)
- **Nightlife Risk Layer** — Partially implemented (activity types exist, addiction system wired)
- **XP Schema** — Fully implemented (wallet, ledger, conversions all live)
- **Studio Booking** — Implemented (booking flow, session production, recording)
- **DikCok Social Media** — Basic version live (video creation, feeds, thumbnails, engagement)
- **Music Video Release** — Implemented (release workflow, promotion, views system)
- **UI Improvements** — Done (themes, languages, version header, navigation)
- **Education System** — Implemented
- **Gig System** — Multiple rounds of fixes and improvements shipped
- **Record Label System** — Recently expanded (v1.1.127)
- **Fame/Popularity Design** — Integrated across systems

### Partially Implemented (have significant remaining work)

| System | What Exists | What's Missing |
|--------|------------|----------------|
| **Festival Expansion** (50 tasks) | Basic festival page, applications, admin | Contract negotiation, setlist editor, performance minigame, schedule conflicts, ticket tiers, fan voting, lineup posters — ~45 of 50 tasks remain |
| **Twaater Improvements** | Core posting, reactions, replies, moderation | Mentions feed (stubbed), trending algorithm, hashtags, media attachments, verification badges, quote twaats, notifications, DM system |
| **DikCok Expansion** | Basic video creation + feed | Multi-feed (Trending/Friends), engagement mechanics (tips, polls), challenges/events, creator analytics, duets/collabs, monetization |
| **Band Jam Sessions 2.0** | Basic jam sessions exist | Live lobby, spectators, session roles, mood meter, venue traits, challenges, recording snippets, NPC cameos, session economy — 18 of 20 improvements |
| **TV/Podcast/Radio Media** | Media facilities exist in DB | Full show creation, episode scheduling, guest booking, ratings system, ad revenue, cross-media synergies — essentially unbuilt |
| **PR Workflow** | Basic PR exists | Analytics integration, AI-assisted pitch drafting, webhook listeners |

### Not Started
- **Nightlife Risk Layer (full version)** — Decision trees, stance system (Stay Sober/Party Hard/Network), probability tables, consequence engine
- **TV/Podcast/Radio** — Entire media vertical system (147 lines of design doc, zero implementation)

---

## Recommended Next Steps (Priority Order)

### Tier 1: High-Impact, Moderate Effort
1. **Twaater Improvements** — Activate mentions feed, implement trending algorithm, add hashtag support, verification badges. These are mostly UI + query work on existing tables.
2. **Festival Expansion (Player-facing batch)** — Contract negotiation UI, setlist editor, schedule conflict detection, performance outcomes. Builds on existing festival infrastructure.

### Tier 2: High-Impact, Larger Effort
3. **Band Jam Sessions 2.0** — Mood meter, venue traits, session challenges, recording snippets. Deepens a core gameplay loop.
4. **DikCok Expansion** — Multi-feed, challenges, creator analytics. Extends an existing but shallow system.

### Tier 3: New Systems
5. **TV/Podcast/Radio Media** — Full new vertical. Very large scope (facilities, shows, episodes, ratings, ads). Could be phased.
6. **Nightlife Risk Layer (full)** — Decision tree engine, stance system, consequence resolution. Adds strategic depth to an existing feature.

### Tier 4: Maintenance
7. **Fix `@ts-nocheck` files** — 4 files need type-checking re-enabled after types regenerate
8. **PR Workflow TODOs** — Analytics, AI pitch drafting (lower priority polish)

---

## What would you like to tackle?

Pick a system (or multiple) and I will create a detailed implementation plan. The Twaater improvements and Festival expansion offer the best bang-for-effort ratio since the infrastructure already exists.

