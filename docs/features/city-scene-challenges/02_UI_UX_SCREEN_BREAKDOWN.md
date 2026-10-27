# RockMundo — City Scene Challenges
## 02. Visual UI/UX Screen Breakdown

**Status:** Proposed design for desktop-first RockMundo and its mobile companion  
**Visual direction:** Rock gig-poster wall × festival programme × live community dashboard  
**Implementation principle:** Strong visual impact from responsive 2D layers, textures, existing avatar assets and purposeful micro-interactions; no heavy 3D scene needed.

---

## 1. Visual identity

The feature should feel **like walking into a legendary venue and finding a wall covered in gigs, rival-band flyers, stickers, torn posters and handwritten notices**, with each player's contributions changing the wall.

### Style tokens (suggestions, map to existing RockMundo tokens)

| Token | Suggested value | Use |
|---|---|---|
| `scene.bg` | `#101019` | Dark concert-room backdrop |
| `scene.panel` | `#1E1B2C` | Poster backing and card surfaces |
| `scene.purple` | `#9560DB` | Primary RockMundo scene progress accent; match actual site purple |
| `scene.orange` | `#F28A44` | Gig-flyer warmth, monthly highlight |
| `scene.gold` | `#F4C76E` | Achievements, scene awards |
| `scene.green` | `#46C89A` | Completed / claimable |
| `scene.text` | `#F8F5FF` | High-contrast text |
| `scene.muted` | `#B5ACC9` | Secondary text |

**Typography:** Reuse the game UI font for functionality; add a compact bold/distressed display-face effect only for scene titles and posters. Never embed text as the sole means of conveying goals or time remaining. Use existing fonts; source custom fonts only through normal licensing.

**Textures:** 2–3 reusable light assets (paper grain, torn paper edges, tape/sticker) applied consistently; no distinct giant image per challenge. Prefer CSS masks, SVG shapes or small transparent WebP assets. Add subtle parallax only where performant.

**City identity:** Theme title, illustrated skyline/cultural motifs, local venue flavour, and season-colour variations; keep city name and theme data-driven. Generic fallbacks for all cities. Do not imply real-life geography/artwork for a city unless assets are approved.

### Scene mural reveal
- Four immutable poster layers `0%, 25%, 50%, 75%, 100%` or composited masks revealing a single poster progressively.
- The poster is a visually interesting **community trophy**, not a progress bar replacement. All critical percentages remain text-readable.
- At 25% a headline or border appears; at 50% central city artwork; at 75% illustrated crowd/instruments; at 100% gilded festival-style completion emblem, finished poster, and gallery entry.
- Use the same poster renderer in the Scene Board, Today's News, player sharing surface and history gallery.

## 2. Screen inventory and navigation

| Screen / component | Purpose | Must-have elements | Entry points |
|---|---|---|---|
| **A. City Scene Board** | Primary daily/weekly/monthly home | Hero poster, scene level, 3 tabs/sections, challenge cards, community feed, rewards | City hub, Today’s News, menu |
| **B. Challenge Detail** | Explain specific goal and how to help | Rules, contribution count, qualified actions, CTA into existing game system, reward, evidence | Scene Board card |
| **C. My Contributions & Rewards** | Track own verified actions and claims | Points, pending/claimed rewards, breakdown, history, privacy option | Board personal card, Profile |
| **D. Scene Leaderboards** | Give recognition, discover others | Player/band views, category filters, avatars, contribution score, opt-out | Board lower panel |
| **E. Monthly Poster & History** | Long-term prestige and visual payoff | Poster reveal, monthly stages, 25/50/75/100%, finished archive, scene story | Board hero, City profile |
| **F. Admin Configuration** | Guard fairness and reliability | Template filters, source health, targets, rewards, event audit, dry-run/preview | Admin |
| **G. Small reusable widgets** | Increase cross-game discovery | Mini city tile, Today’s News card, inbox claim, city map marker | Existing game pages |

## 3. Screen A — City Scene Board

### Desktop wireframe (structural, not pixel-exact)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← CITY HUB        PORTSMOUTH: MAKE SOME NOISE    [Scene Status: RISING]       │
│ ┌──────────────────────────────────────────┐  ┌───────────────────────────┐ │
│ │ MONTHLY HERO POSTER / MURAL              │  │ SCENE CONTRIBUTOR CARD     │ │
│ │ City skyline + torn posters + stage      │  │ Your rank #12              │ │
│ │ reveal @ 25/50/75/100%                  │  │ Your points 18             │ │
│ │  ██████████████░░░ 72%                  │  │ [Rewards: 2 ready]         │ │
│ │ [See monthly campaign]                  │  └───────────────────────────┘ │
│ └──────────────────────────────────────────┘  ┌───────────────────────────┐ │
│                                               │ LIVE CITY FEED            │ │
│ [ DAILY ] [ WEEKLY ] [ MONTHLY ]               │ +2: local jam finished    │ │
│ ┌──────────────────┐ ┌──────────────────┐      │ Band hit 50% milestone    │ │
│ │ Promo another gig │ │ Join a jam       │      │ [See activity]            │ │
│ │  █████░░ 5/8     │ │ ███░░░ 3/6       │      └───────────────────────────┘ │
│ │ Reward: 100 XP   │ │ Reward: XP/fame  │                                    │
│ │ [Find a gig]     │ │ [Find jam]       │      TOP CONTRIBUTORS             │
│ └──────────────────┘ └──────────────────┘      avatar + name + rank          │
│ ┌──────────────────┐                           [See full leaderboard]        │
│ │ Finish rehearsals│                                                        │
│ │ ████░░░ 3/5      │                                                        │
│ │ [Browse bands]   │                                                        │
│ └──────────────────┘                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Hero section
- Full-width 16:9 or wide, with purposeful image overlay; city name and **live campaign title** as accessible DOM text.
- Visible community progress percentage and counts; posters layer behind the metrics, never obscuring them.
- Countdown until cadence reset (e.g. "Resets in 08h 42m"); UTC source-of-truth with local formatting.
- Small city genre/mood tag such as Indie / Electronic / Jazz *only when backed by curated content*, not unverified autogenerated real-world classification.
- A single scene status label from progress and recent engagement: Starting / Building / Rising / Electric / Legendary; decorative only unless it represents a defined score.

### Challenge card
Every card includes icon/art motif; objective title; one-sentence objective; progress `earned / target` and accessible progressbar; deadline; reward preview; compact 'Your contribution' line; one real action link (e.g. browse gigs) and optional 'Details'. Visually distinguish incomplete, in progress, complete, reward-ready, claimed and locked/source-unavailable states.

### Responsive layout
- Desktop >= 1200px: poster + 3 challenge cards in main column, contribution/feed in right rail (~1/3).
- Tablet: 2 columns of cards; feed moves beneath goals.
- Mobile: one-column poster (cropped gracefully) -> horizontal Daily/Weekly/Monthly tabs -> stacked cards -> personal rewards -> feed. No side-scrolling required to read essential status.
- The companion app can show status, rewards and deep links to supported activities. If an activity is desktop-only, show **Open in desktop game** rather than a broken action.

## 4. Screen B — Challenge detail

```text
┌──────────────────────────────────────────────────────────────────┐
│ [BACK]  SPREAD THE WORD              Daily  · Ends in 6h         │
│ Illustration: flyer, tape, megaphone, local concert poster      │
│ Community progress   5/8 verified promotions    [██████░░]      │
│ Your contribution    2 scene points                            │
│ WHAT COUNTS: Promote a different local band's scheduled gig    │
│ DOES NOT COUNT: Your own band / repeated share / fake booking  │
│ REWARD: Daily eligibility & shared city milestone              │
│ [FIND LOCAL GIGS TO SUPPORT] [VIEW ALL SCENE GOALS]             │
│ Recent contribution feed, verified only                         │
└──────────────────────────────────────────────────────────────────┘
```

- Context CTA should preserve return navigation and show one authoritative destination.
- Show source event evidence on user's own contributions (e.g. gig name and completion date) where permitted; never leak private details of other participants.
- Render 'Unavailable due to source maintenance' gracefully; template scheduler should normally replace unhealthy source goals next cycle.

## 5. Screen C — My Contributions & Rewards

### Personal panel
- Character's **head-and-shoulders avatar**, username and city emblem; reuse existing avatar renderer with a robust silhouette fallback (important because the project has known portrait-loading problems).
- Daily/weekly/monthly personal progress and rank, **distinct** from the shared city bar.
- Timeline of credited events, e.g. "Promoted Velvet Static's gig — +1 SP"; separate personal/private evidence from public feed.
- Reward tiles for `Locked`, `Ready to claim`, `Claimed`, `Expired` with outcome/retry messaging and immutable grant references.
- No misleading "You earned cash" banner unless the canonical balance actually changed.
- User settings: hide from leaderboards, reduce notifications, follow city scene.

### Interaction states
- Loading skeleton for poster and cards; no flicker to 0 points.
- Optimistic visual toast may show *processing*, never success before server confirmation.
- On reward success: quick golden light sweep + checkmark; on error: actionable retry preserving pending entitlement.
- If a new action is delayed in a post-gig processor: "Waiting for activity verification" on own timeline; do not immediately award.

## 6. Screen D — Contributor leaderboards

### Tabs and rankings
- `Players | Bands`, plus `Daily | Weekly | Monthly` and optional `Newcomers` section.
- Player rows show rank, avatar headshot or fallback, public name, associated band where allowed, total verified points, a descriptive contribution tag.
- Band rows show banner or reliable band image and score; band score is sum of individually valid events attributed at event time and may be subject to a fairness cap.
- Tie-break ordering deterministic: higher points, earlier time reaching score, then stable identifier (only as final deterministic tie-break).
- Preserve accessible opt-out: hidden identities display "Private contributor", and private activity details are not exposed.
- Avoid paying out top-three cash rankings: increases alt farming and makes small city scenes punitive.

## 7. Screen E — Monthly campaign + artwork archive

**Focus:** This is the feature's strongest long-term visual hook.

```text
╔════════════════════════════════════════════════════════════════╗
║  PORTSMOUTH: LIVE MUSIC REVIVAL  / OCTOBER 2026                 ║
║                                                                ║
║           [BIG STYLIZED POSTER / PARTIAL REVEAL]               ║
║                                                                ║
║       0%         25%        50%        75%        100%         ║
║       ◯─────────●──────────●──────────◯──────────◯             ║
║       START    HEADLINE   SKYLINE    CROWD    GOLD POSTER       ║
║                                                                ║
║  Contributors: 36    Goals completed: 6    Time left: 4 days   ║
║  [HOW TO HELP]             [VIEW PAST POSTERS]                  ║
╚════════════════════════════════════════════════════════════════╝
```

- Each archive item links the campaign poster, participating city's name, period, final completion percentage and safe contributor snapshot.
- The finished poster can be shared as a normal game-branded image *only through the existing Share Studio pipeline if it passes the known avatar/null checks*. Without those, use a poster-only export fallback.
- Poster themes can represent city neighbourhoods, musical styles, seasonal events, festival lighting or local symbols. Avoid unlicensed brand/movie imagery.
- At 100% trigger one local in-app celebration (confetti, light burst, sound optionally off by default), then settle to a stable completed state. Replay button only if desired; respect reduced-motion.

## 8. Screen F — Admin configuration

Administrators need: city/template inspector, feature flags, daily/weekly/monthly schedule previews, eligibility filters, source health, population snapshot/target override with justification, reward tuning, approved art themes, event/reward audit, repair/reconcile and rollback.

**Never** allow public mayors to directly change XP/fame grants or target values. Optional city poll/theme selection can be added later through an approved curated catalogue.

## 9. Reusable cross-game UI

1. **City hub tile:** tiny mural, progress %, next unlock and `Visit Scene Board`.
2. **Today's News scene block:** city-specific new challenges, rising artists, milestones and monthly reveal; collapsible to match existing news redesign.
3. **Inbox claim card:** artwork thumbnail, reward type and unambiguous expiry.
4. **Player profile badge:** obtained city's monthly collectible emblem and poster gallery link.
5. **Map pin (future):** small coloured glow/scene emblem; hover card shows normalised rank and campaign title. Do not add map complexity to MVP.
6. **Band details:** one tasteful `Scene contributor` tag, not excessive notification clutter.

## 10. Art direction and asset checklist

| Asset | Reuse/generate | Priority | Notes |
|---|---|---|---|
| Scene Board poster-wall base | 1 reusable theme asset + CSS layering | P0 | Adaptable dark / light |
| Monthly campaign posters | Template with city title, skyline motif, genre accent | P0 | Data-driven names / monthly variants |
| 4 reveal masks/layers | SVG/CSS masked sections | P0 | Test determinism at each threshold |
| Challenge card icons | Existing Lucide icons / small SVGs | P0 | Fast and reliable |
| Player/band headshots | Existing avatar / image loaders | P0 | Head and shoulders; robust fallback |
| Milestone sparkle / lights | CSS / SVG animation | P1 | Reduced-motion alternative |
| Scene emblem and badges | Reusable badge system | P1 | City/year/month label |
| Gallery frame / poster border | CSS textures | P1 | Maintains aspect ratio |
| Seasonal city skins | Curated templates | P2 | No dynamic new renderer required |
| World-map scene glows | Existing map pins + metadata | P3 | Later expansion |

## 11. Micro-interactions that matter

- **Verified contribution:** points rise on personal counter; nearest objective fills smoothly; a small footer toast names the underlying action.
- **Community milestone:** mural peels back like lifting a gig flyer; subtle concert-light sweep (max ~600ms).
- **Claim reward:** gold highlight settles into a receipt check state, never loops.
- **Leaderboard position:** gentle moved-up indicator, not flashing rank animation on every query refresh.
- **Monthly finish:** one optional cinematic 2D poster reveal with city name, contributors, achievement emblem and optional share; no expensive 3D.

Recommended animation specs: ordinary UI state transition ~150–250ms; major reveal ~450–650ms, limited to one on deliberate open/new unlock; no continuous confetti; `prefers-reduced-motion` disables movement and substitutes static state changes. Avoid autoplay audio.

## 12. Accessibility, reliability and performance

- Meet WCAG AA target for contrast and keyboard navigation. Progress conveyed in text and semantics, not colour alone.
- Each countdown can pause visually in hidden tabs; it must recompute correctly from server timestamps on reopen.
- Images lazy-load, use responsive sizes / WebP/AVIF as supported; reserve aspect ratio to avoid layout shift.
- Error-safe avatars, poster fallback and feed skeletons; never allow missing media to crash the whole board.
- Realtime updates should be debounced; on reconnection refresh canonical counts rather than stacking local increments.
- Avoid dozens of row subscriptions: subscribe per scene/cycle or poll aggregate at modest frequency.
- Mobile-first touch targets >=44px, no hover-only controls.
- For the companion app, route unsupported deep links to explanatory desktop-game link with RockMundo branding; do not invite full desktop flows into a broken in-app webview.
- Follow existing project component patterns and the app's real live version/banner conventions (never label feature 'beta').

## 13. Visual QA / sign-off checklist

- [ ] Looks unmistakably like RockMundo, not a generic SaaS task dashboard.
- [ ] Daily, weekly and monthly each distinguishable at a glance.
- [ ] Posters and scene status update at all milestone thresholds and after reset.
- [ ] Head-and-shoulders avatar images display, with fallback and no null-ID crash.
- [ ] 320px mobile, tablet and large desktop screens have coherent layouts.
- [ ] High-contrast / low-motion / keyboard-only accessibility validated.
- [ ] Progress remains readable over art/textures; empty cities have inviting zero states.
- [ ] No inaccurate instant-success confetti when verification is pending.
- [ ] End-of-period archived art accessible from city/history pages.
- [ ] Failed or slow render does not interfere with core challenge functionality.
