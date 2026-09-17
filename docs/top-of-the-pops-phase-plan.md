# Top of the Pops implementation

## Scope

PR #1921 implements the agreed RockMundo Top of the Pops feature. This document now records the completed scope only; further specials, extra presenter variants and other expansions are outside this branch.

## Phase 1 — Event and chart foundation

Implemented.

- Fortnightly Thursday cadence anchored from 17 September 2026.
- London-only television studio event.
- UK Top 40 eligibility from live `chart_entries` streaming and digital-sales chart data.
- One locked qualifying song and rank per selected band.
- No consecutive-episode appearances by the same band.
- Deterministic editorial selection seeded by episode so retries cannot reroll invitations.
- Preparation is idempotent: once an episode has candidates, retries return the existing episode without rebuilding invitations, erasing responses or changing the chart snapshot.
- Monday preparation cron with server-only execution.

## Phase 2 — Invitation and studio workflow

Implemented.

- Player invitation read RPC.
- Band-leader-only accept/decline workflow.
- Expired responses persist as `expired` rather than being rolled back by an exception.
- Existing notifications system used for invitations and completion messages.
- Two-hour pre-call check-in window with a 45-minute late cutoff.
- Every active player-controlled non-touring member must be physically in London and not travelling.
- Public episode/running-order read model.
- Admin running-order lock includes checked-in acts only.
- Deterministic running order and stage assignment.
- A checked-in qualifying #1 act closes the programme; later presenter migrations preserve the same rule.
- Presenter introduction generated from the locked chart rank, artist and song.

## Phase 2.5 — Routes and navigation

Implemented.

- `/top-of-the-pops` is wired into the authenticated application route tree.
- `/admin/top-of-the-pops` is wired inside the existing `AdminRoute` boundary.
- Music → Charts & Market includes Top of the Pops.
- Route titles are registered for the admin surface.
- The player page handles invitations, check-in, current episode, history and archived broadcasts.
- The admin page controls running-order locking, settlement and archive generation.

## Phase 3 — 3D television studio and archive

Implemented.

- Reuses the existing `GigCanvas`, `GigStage3D` and `ConcertScene` renderer path through `presentationMode="totp"`.
- Dedicated `tv_studio` venue profile with compact television-studio geometry.
- Physical presenter rostrum/backdrop, pedestal cameras/operators, handheld camera/operator, jib and studio monitors.
- Dedicated presenter, crane, overhead, audience-reverse, tracking and low-angle television camera transforms.
- Four physical performance zones: `main_stage`, `stage_b`, `rock_stage` and `studio_floor`.
- Existing player avatars, clothing, instruments and performer reconstruction are reused.
- Deterministic broadcast timelines, presenter captions and chart lower-thirds.
- Reduced-motion fallback uses a stable studio presentation.
- Immutable canonical broadcast replays with checksum/version metadata.
- Replay snapshots preserve locked production outcome, presenter/show identity and historical performer visuals.
- Public archive playback is presentation-only and never re-awards fame, XP or money.
- Full-episode playback follows locked running order and supports direct act replay.
- Hosted programme intro supports `VITE_TOTP_INTRO_URL` with `/media/totp-intro.mp4` fallback and a Skip option.
- TV-studio audience blocking keeps fans clear of secondary stages and production equipment.
- Locked audience reaction drives TOTP-only density and choreography from restrained movement through clapping/waving to high-energy jumping/dancing.
- Ordinary gigs retain their existing crowd behaviour.

## Phase 4 — Rewards, history and achievements

Implemented.

- Admin-only idempotent performance settlement.
- Rank-sensitive fame reward with debut lift, repeat diminishing returns and the existing high-fame progression curve.
- £0 appearance payment and no chart manipulation.
- Permanent appearance history and per-band statistics.
- Eight Top of the Pops achievements covering debut, chart rank and appearance milestones.
- Collective band fame plus smaller eligible member fame share.
- Existing `band_fame_events` audit trail used for settled rewards.
- Official `@rockmundo_tv` Twaater post is guarded against duplicates.
- Band → Fame résumé card shows completed Top of the Pops career history.

## Phase 5 — Interactive television production

Implemented.

- One deterministic pre-show presenter interview per checked-in invitation.
- Leader-only interview choices with bounded reputation/fan/media effects.
- One deterministic live-production incident per checked-in act.
- Recovery choices for incidents that require a response, with neutral fallback if skipped.
- Leader-selected performance styles with tightly bounded fame variance.
- Studio-audience reaction meter: Nervous, Settled, Warm, Loud or Roaring.
- Final audience reaction is frozen into the canonical replay.
- Existing deterministic presenter rotation and milestone/guest-host variants are frozen into the replay.
- One deterministic post-performance green-room interaction per completed appearance.
- Post-show choices affect reputation/fan/media only and do not alter fame, chart position, cash or future eligibility.
- All random-looking outcomes are server-seeded so refreshes cannot reroll them.

## Release verification

Before merge/deployment:

- TypeScript typecheck must pass on the final branch head.
- TOTP/shared-renderer lint errors introduced by this branch must be cleared; the repository-wide lint baseline remains enforced.
- Existing TOTP regression tests must run successfully once the lint gate allows the CI pipeline to continue.
- Build must complete successfully.
- Supabase migrations remain undeployed until the branch is approved for release.
- Production may optionally configure `VITE_TOTP_INTRO_URL`; the same-origin fallback remains available if it is not configured.

No additional Top of the Pops feature expansion is part of this completion pass.
