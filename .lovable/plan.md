# System Expansion Status — Updated v1.1.135

## ✅ Fully Implemented (Historical Reference)
- Marriage & Children, Night Clubs, XP Schema, Studio Booking, Education, Gig System, Music Video Release, UI/Themes/Languages, Fame/Popularity

## ✅ Recently Implemented (v1.1.131–1.1.135)
- **Twaater** — Mentions feed, trending algorithm (time decay + verified boost), hashtag system, notifications bell, quote twaats, polls, verification badges (auto-verify via fame/awards/charts), explore/search
- **Jam Sessions 2.0** — Venue traits (8 types), session challenges (9 across 4 tiers), mood meter + synergy, participant roles/instruments
- **DikCok 2.0** — "For You" personalized feed, creator dashboard (tier progression + analytics), 5-tab layout
- **Festival** — History tab with past performance metrics, contract negotiation dialog, setlist editor
- **Song Audio** — Fixed regeneration flow, improved lyrics generation with 550-char constraint

## 🟡 Partially Implemented (Remaining Work)

### Twaater (Medium Priority — mostly done)
| Feature | Status | Effort |
|---------|--------|--------|
| Media attachments (image uploads) | ❌ Not built | Medium |
| DMs / Direct Messages | ❌ Not built | High |
| Scheduled twaats | ❌ Not built | Low |
| Lists/bookmarks | ❌ Not built | Low |
| Promoted twaats (economy sink) | ❌ Not built | Medium |
| Analytics dashboard for verified | ❌ Not built | Medium |

### Festival Expansion (45 of 50 tasks remain)
| Feature | Status | Effort |
|---------|--------|--------|
| Schedule conflict detection | ❌ | Medium |
| Performance minigame loop | ❌ | High |
| Post-show reviews & highlight reels | ❌ | Medium |
| Ticket tier management + dynamic pricing | Partial (TicketTierManager exists but @ts-nocheck) | Medium |
| Fan voting for open slots | ❌ | Medium |
| Crew/engineer assignments | ❌ | Medium |
| Merch/food stall revenue sharing | ❌ | Medium |
| Admin lifecycle consolidation | ❌ | High |

### DikCok Expansion
| Feature | Status | Effort |
|---------|--------|--------|
| Duet/collab mode | ❌ | High |
| Fan tips/hype tokens | ❌ | Medium |
| Weekly trend challenges | ❌ | Medium |
| Beat challenges (rhythm minigame) | ❌ | High |
| Fan missions | ❌ | Medium |
| Creator guilds | ❌ | High |

### Jam Sessions 2.0 (Remaining)
| Feature | Status | Effort |
|---------|--------|--------|
| Live lobby (async drop-in/out) | ❌ | High |
| Spectator slots | ❌ | Medium |
| Recording snippets | ❌ | Medium |
| NPC cameos | ❌ | Medium |
| Session economy (tickets, refreshments) | ❌ | Medium |
| Jam contracts (venue residencies) | ❌ | Medium |
| Band diary feed auto-posts | ❌ | Low |
| Gifted song drops (0.75% chance) | ❌ | Medium |
| Progressive unlocks | ❌ | Medium |

## ❌ Not Started

### TV/Podcast/Radio Media (Very Large)
- Full new vertical: show creation, episode scheduling, guest booking, ratings, ad revenue, media buzz
- Some DB infrastructure exists (media_facilities, radio stations, radio content)
- **Recommended approach**: Phase 1 only — basic show creation + booking flow + ratings

### Nightlife Risk Layer (Full Version)
- Decision trees, stance system (Sober/Party/Network/Leave Early), probability tables
- Consequence engine (exhaustion, scandal, addiction arcs, eureka moments)
- Currently zero implementation of the decision/stance flow

## 🔧 Technical Debt
- **27 files with `@ts-nocheck`** — up from 4 previously identified. Key files: BandRosterTab, TicketTierManager, MusicVideoReleaseTab, Housing, CompetitiveCharts, recording page, 8 API modules, VersionHistory
- **PR Workflow TODOs** — Analytics integration, AI-assisted pitch drafting

---

## Recommended Next Steps (Priority Order)

### Tier 1: High-Impact, Moderate Effort
1. **Nightlife Risk Layer** — Decision tree + stance system. Adds strategic depth to an existing nightlife feature. Core engine: stance selection → probability resolution → consequence application.
2. **Festival Schedule Conflicts + Performance Outcomes** — Conflict detection across gigs/tours/rehearsals + post-performance breakdowns (fame/payment/merch).

### Tier 2: High-Impact, Larger Effort
3. **Jam Sessions 2.0 — Gifted Song Drops + NPC Cameos** — The two most game-feel-enhancing remaining features. Song drops add excitement; NPC cameos add world flavor.
4. **DikCok Weekly Challenges + Fan Tips** — Adds recurring engagement loop and economy sink.
5. **Twaater Media Attachments** — Image uploads to twaats would significantly increase engagement feel.

### Tier 3: New Systems
6. **TV/Podcast/Radio Phase 1** — Basic show creation, booking, and ratings. Very large scope; recommend only core booking + ratings loop.

### Tier 4: Maintenance
7. **Fix `@ts-nocheck` files** — 27 files need type-checking re-enabled. This is accumulating technical debt.
8. **PR Workflow TODOs** — Low priority polish.

---

## Pick what to build next!
