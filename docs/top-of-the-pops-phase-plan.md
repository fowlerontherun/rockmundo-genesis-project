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

In progress in PR #1921.

Implemented:

- Added `presentationMode="totp"` to the shared `GigCanvas` / `GigStage3D` renderer path.
- Added a dedicated `tv_studio` venue profile to the existing 3D venue engine rather than creating a second renderer.
- The television centre uses a compact house-production room, low roof, dense standing audience and dedicated TOTP presentation identity.
- TOTP continues to use the existing player avatars, clothing, instruments, performer reconstruction, crowd tuning and WebGL `ConcertScene`.
- Added deterministic presenter/performance broadcast timelines.
- Added TOTP camera-shot vocabulary mapped onto the existing 3D camera system.
- Added a broadcast wrapper that overlays show branding, Alex Rayne presenter captions and chart lower-thirds over the shared 3D renderer.
- Added reduced-motion fallback to the stable studio-master shot.
- Added tests for camera targeting, timeline construction and the TV-studio venue profile.

Next within Phase 3:

- Add visible pedestal cameras, handheld operators and a crane/jib to the `tv_studio` scene geometry.
- Add a presenter 3D model/position rather than caption-only presenter sequences.
- Add dedicated studio camera transforms beyond the current mapping to shared camera presets.
- Persist/reconstruct a canonical TOTP performance replay so every broadcast can be watched again from the archive.
- Connect the episode viewer page to that canonical replay.
- Add multiple performance-zone geometry to match `main_stage`, `stage_b`, `rock_stage` and `studio_floor` assignments.

## Phase 4 — Rewards, history and achievements

- Fame reward after a completed appearance; no cash payment.
- Rank-sensitive fame tiers with diminishing lifetime returns.
- Permanent episode archive and appearance history.
- First appearance, Top 20, Top 10, #1, 5/10/25/50 appearance achievements.
- Profile statistic for Top of the Pops appearances.
- Twaater/media reaction events after broadcast.

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