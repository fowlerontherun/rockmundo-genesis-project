# Top of the Pops phased implementation

## Phase 1 — Event and broadcast foundation

Implemented in PR #1921.

- Fortnightly Thursday cadence anchored from 17 September 2026.
- London-only television studio event.
- UK Top 40 eligibility from the live `chart_entries` streaming and digital-sales chart data.
- Immutable qualifying song/rank snapshot.
- No consecutive-episode appearances by the same band.
- One eligible song per band, using the highest-ranked qualifying song.
- Deterministic editorial selection seeded by episode so retries cannot reroll invitations.
- Dedicated `totp` broadcast profile designed to reuse the 3D Gig Viewer.
- Main, secondary, rock and studio-floor stage concepts.
- Presenter, crane, studio-master, close-up, instrument, drummer, tracking, audience and finale shot vocabulary.

## Phase 2 — Invitation and studio workflow

Implemented in PR #1921.

- Player invitation read RPC.
- Band-leader-only accept/decline RPC.
- Invitation notifications through the existing notifications system.
- Two-hour studio check-in window opening before the scheduled London call time.
- Every active player-controlled non-touring band member must be physically in London and not travelling.
- Public episode read model.
- Admin running-order lock that only includes successfully checked-in acts.
- Deterministic running order and stage assignment.
- Initial presenter introduction generated from the locked chart rank, artist and song.
- Player Top of the Pops page and admin broadcast control page components.

## Phase 2.5 — Route/navigation integration

Pending final route patch.

- Add `/top-of-the-pops` to the authenticated application route tree.
- Add `/admin/top-of-the-pops` behind `AdminRoute`.
- Add Top of the Pops to the most appropriate Music/World navigation surface.
- Route Top of the Pops notification clicks to the invitation page.
- Add dashboard callouts for upcoming broadcasts and outstanding invitations.

The page components and APIs are implemented. The remaining work is confined to the large central route/navigation files, which should be patched without replacing unrelated route content.

## Phase 3 — 3D television studio integration

Implemented substantially in PR #1921.

- Added `presentationMode="totp"` to the shared `GigCanvas` / `GigStage3D` renderer path.
- Added a dedicated `tv_studio` venue profile to the existing 3D venue engine rather than creating a second renderer.
- The television centre uses a compact house-production room, low roof, dense standing audience and dedicated TOTP presentation identity.
- TOTP continues to use the existing player avatars, clothing, instruments, performer reconstruction, crowd tuning and WebGL `ConcertScene`.
- Added deterministic presenter/performance broadcast timelines.
- Added a broadcast wrapper that overlays show branding, Alex Rayne presenter captions and chart lower-thirds over the shared 3D renderer.
- Added reduced-motion fallback to the stable studio-master shot.
- Added physical TV-production geometry inside `tv_studio` only: two pedestal cameras/operators, a handheld camera/operator, a jib/crane and three studio monitors.
- Added Alex Rayne as a physical in-scene presenter on a dedicated rostrum/backdrop, while keeping the caption layer for accessibility and readable dialogue.
- Added dedicated studio camera transforms for presenter wide/close, crane sweeps, overhead, audience reverse, side tracking and low-angle performance shots.
- Presenter and performance timeline cues now drive those dedicated camera IDs directly through `GigStage3D` into `ConcertScene`, producing real Alex Rayne -> stage broadcast cuts.
- Crane/tracking transforms use restrained deterministic movement while the external replay clock keeps seeking/replays stable.
- Added four physical performance zones: `main_stage`, `stage_b`, `rock_stage` and `studio_floor`.
- Locked running-order stage assignment now reaches performer reconstruction, so archived/live acts render in the correct studio zone.
- Added immutable `totp_broadcast_replays` archive rows containing the exact TV cue sequence, presenter intro, chart graphic, stage assignment and frozen band lineup/roles.
- Added checksum/version metadata so historical broadcasts remain auditable and deterministic.
- Added admin archive generation and a public read-only broadcast archive RPC.
- Added a 3D archive player that reconstructs presentation-only events from the frozen snapshot and feeds the saved cues back through `TotpBroadcastCanvas`.
- Replaying an archived broadcast never calls completion, reward or progression paths.
- The Top of the Pops page can select and replay archived performances through the real television-studio renderer.
- Added tests proving the TV studio gets the production objects and normal gig venues do not.
- Added tests for camera targeting, timeline construction, TV-studio geometry and archive payload shape.

Remaining polish within Phase 3:

- Add studio-specific audience blocking around each performance zone and ensure visible production cameras never collide with performer staging.
- Snapshot equipped clothing/appearance into the archive payload so very old appearances can preserve the exact historical outfit rather than resolving the current player model.
- Add a full-episode autoplay mode that joins all archived performances and presenter transitions into one continuous show.

## Phase 4 — Rewards, history and achievements

Implemented substantially in PR #1921.

- Added an admin-only idempotent performance-completion path. A performance can be settled repeatedly after a network retry, but fame/history/achievements are written only once.
- Rank-sensitive raw fame rewards: #1 is highest, followed by #2–3, Top 10, Top 20, Top 30 and #31–40.
- First TV appearance receives a modest 20% fame lift.
- Repeat appearances use a diminishing-return curve with a 60% floor, preventing Top of the Pops from becoming a farmable fame loop.
- Fame also follows RockMundo's existing collective-fame long-tail progression factor, so established global acts do not gain disproportionately large jumps.
- No cash reward is paid and the completion path never changes chart positions.
- Collective band fame is updated and audited in `band_fame_events` with the performance, episode, chart rank and both diminishing factors recorded.
- Active core band members receive a smaller personal-fame share; touring/NPC members are excluded.
- Added permanent `totp_appearance_history` with episode, song, chart rank, stage, appearance number and settled fame.
- Added public history and band-stat RPCs for appearances, best chart rank, #1 appearances, Top 10 appearances and total TOTP fame.
- Added player-facing Top of the Pops history to the main show page.
- Added admin settlement status beside every act in the running order.
- Seeded eight achievements: TV Debut, Top 20 Performer, Top 10 Performer, Top of the Pops (#1), Household Name (5), Television Regular (10), Pop Institution (25) and Legend of the Pops (50).
- Achievement settlement is compatible with the current live legacy achievement schema and with the later canonical achievement migration.
- Added a small TOTP achievement-settlement bridge so achievement unlocks are idempotent even before canonical source-event fields reach production.
- Added notification deep-link metadata for completed appearances.
- Live schema was checked before finalising the migration; TOTP no longer assumes the not-yet-live canonical achievement columns/functions.
- Added a verified `@rockmundo_tv` Twaater bot identity for official television posts.
- Every completed appearance now publishes exactly one official Twaater reaction using an audited `totp_media_posts` link table.
- Twaater copy varies for TV debuts, Top 10 appearances, UK #1 performances and 5/10/25/50 appearance milestones.
- Twaater publishing has a second performance-level duplicate guard, so retrying settlement cannot spam posts.
- Bot posts are public, system-generated, award no player XP, and use the live Twaater 500-character/sentiment constraints.

Remaining within Phase 4:

- Surface `totp_band_stats` directly on the main public band profile / band fame page.
- Add achievement-specific presentation polish (special badge art/title treatments) if desired.

## Phase 5 — Interactive television production

- Backstage/green-room interactions.
- Presenter interview choices with reputation/fan/media effects only.
- Performance-style choice with modest fame variance, never chart impact.
- Studio-audience reactions and television-specific crowd behaviour.
- Rare harmless production incidents and live-show flavour events.
- Guest presenters and milestone specials.

## Phase 6 — Specials

- Christmas Top of the Pops tied to the Christmas #1 system.
- Year in Review special.
- Episode 100 / anniversary specials.
- Historic-return presenter scripts and archive callbacks.
