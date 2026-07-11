# Phase 5 PR 10 — Viewer Release Hardening, Analytics, Canonical Event Expansion and Phase Review

## Recommendation source

This PR is the release gate after Phase 5 PR 04 through PR 09 delivered server-authoritative progression, immediate `result_ready_at` semantics, canonical replay storage, deterministic Canvas playback, crowd/performer presentation, story commentary, highlights, finale, result reveal, and reduced-motion/DOM equivalents.

## Defects found

### P0 beta blockers

- **Unverified database/browser gate in this environment.** The local container could run TypeScript through the available toolchain, but dependency installation failed before lint/build/Vitest/browser tooling became available, and no Supabase CLI/database stack was present; clean reset, SQL harnesses, browser smoke, mobile screenshots, and automated accessibility runs could not be marked passed.

### P1 high priority fixed

- **Stale replay generation could remain blocked.** The service-role generation claim treated any `generating` row as active indefinitely. A forward migration now lets service-role retries mark rows older than 15 minutes as `failed` with `generation_timeout` and reclaim failed rows without giving normal players regeneration rights.
- **Replay payloads had no explicit release budget.** The shared schema/generator now enforces maximum event count, maximum serialized payload bytes, and bounded message parameter values before a canonical replay is stored.
- **Malformed non-array event payloads could throw during validation.** Validation now returns a controlled `events must be an array` failure instead of continuing into `.length`/iteration.

### P2 improvements / accepted limitations

- Existing `TopDownGigViewer` is retained for in-progress gigs only; completed replay-ready gigs use `GigViewerShell`, and legacy gigs remain report-only.
- No app-level analytics capture helper was found, so no new analytics platform was invented. Metrics are documented as measurable once an approved helper exists.

## Event categories added

No new detailed event categories were added because the audit did not find reliable server-authoritative source data for performer mistakes, recoveries, equipment incidents, singalongs, or explicit solos in the canonical replay generation inputs.

## Event categories left unsupported

| Category | Status | Source assessment | Decision |
|---|---|---|---|
| Performer mistakes | Unsupported | `gig_song_performances.performance_score` and report commentary can imply weakness but do not identify a mistake event, performer, recovery window, or privacy-safe payload. | Do not infer canonically. |
| Recoveries | Unsupported | No authoritative recovery table/field is included in replay generation. | Do not fabricate. |
| Equipment incidents | Partially supported elsewhere | Completion logic and reports can account for gear/crew factors, but no incident event with timing/source row exists in replay generation. | Leave unsupported until an incident source exists. |
| Singalongs | Unsupported | Crowd response/attendance can suggest enthusiasm but no explicit singalong flag exists. | Do not infer. |
| Explicit performer solos | Unsupported | Performer lineup roles exist, but no solo event/source timing exists. | Keep generic highlights only. |

## Schema/version changes

No event type or payload union was expanded, so viewer version and event schema version remain `1`. Compatibility tests were added for current schema, previous/zero schema, future schema, future viewer version, empty/malformed payloads, oversized event counts, and oversized message parameters.

## Replay-generation hardening

- Service-role `claim_gig_viewer_replay_generation` can now recover rows stuck in `generating` for more than 15 minutes.
- Failed rows can be reclaimed by the same protected service-role claim path.
- Ready rows remain immutable from the normal player path and are returned instead of regenerated.
- Outcome result availability remains independent from replay generation.
- Controlled error codes now include payload budget failures such as `REPLAY_EVENT_LIMIT_EXCEEDED`, `REPLAY_PAYLOAD_LIMIT_EXCEEDED`, and `generation_timeout`.

## Database gate

Prepared verification covers Phase 5 migrations, `result_ready_at`, replay uniqueness, generation status constraints, RLS policy shape, service-role RPC grants, `SECURITY DEFINER` `search_path`, outcome visibility inheritance, and direct replay mutation denial. The database gate was **not passed** in this environment because the Supabase CLI/database stack was unavailable to run a clean reset and SQL harnesses.

## Browser test coverage

Existing repository scripts do not include Playwright, and npm dependency installation failed in the container. Browser smoke coverage is therefore documented as a required beta prerequisite rather than claimed as passed. Deterministic fixtures should cover poor/average/excellent gigs, low/sold-out attendance, solo/normal/large bands, short/long setlists, encore/no encore, generating/failed/missing/legacy/unsupported replay states.

## Mobile coverage

Mobile viewport verification was not run. Required viewports remain narrow Android, modern iPhone, and tablet. Existing responsive implementation uses a stacked layout, bounded Canvas sizing, and mobile crowd caps, but this PR does not claim measured mobile screenshots.

## Accessibility coverage

Static audit confirmed semantic controls, timeline list, `aria-current`, text graph alternative, Canvas companion status, reduced-motion preference, and report access without watching. Automated axe/browser keyboard flow was not run because the browser test stack was unavailable.

## Performance results

No measured frame timings were collected in this environment. Release budgets are now explicit:

- maximum canonical replay events: 240;
- maximum serialized event payload: 128 KB;
- maximum message parameter value length: 96 characters;
- one Canvas animation loop while mounted;
- no replay generation or database mutation from playback controls;
- hidden tabs pause playback;
- desktop target: 60 fps where practical;
- representative mobile target: at least 30 fps;
- no persistent payload retention after close/unmount.

## Payload safeguards

The generator validates the replay and then rejects oversized canonical payloads before storage. Limits fail generation with controlled codes; they do not silently truncate canonical events. The contract stores compact event envelopes, IDs, message keys/params, and visual payloads rather than raw database rows or full private profiles.

## Analytics

No established frontend analytics event helper was found under `src/lib`, `src/hooks`, `src/features`, or gig components. This PR therefore does not add a platform. Recommended events remain `gig_replay_opened`, `gig_replay_started`, `gig_replay_paused`, `gig_replay_speed_changed`, `gig_replay_song_seek`, `gig_replay_highlight_seek`, `gig_replay_result_skipped_to`, `gig_replay_completed`, `gig_replay_abandoned`, `gig_replay_restarted`, `gig_report_opened_from_replay`, `gig_replay_failed`, `gig_replay_unsupported`, and `gig_replay_reduced_motion_used` once an approved helper exists.

## Engagement metrics

Once analytics exists, measure replay-open rate, percentage watching at least one song, median watch time, skip-to-result rate, replay completion rate, restart rate, report-open rate, mobile abandonment, replay error rate, reduced-motion usage, and percentage of gigs with replay unavailable.

## Compatibility cleanup

- Retained `TopDownGigViewer` for current in-progress presentation so no live route becomes blank.
- Retained `useRealtimeGigAdvancement` compatibility alias as a read-only/server-authoritative hook from PR 04.
- Retained report-only fallback for legacy or unavailable replays.
- No stale “Skip to Outcome” copy was changed in version history; current completed-gig copy uses Replay/View Result paths.

## Security/privacy

Replay reads remain through RLS-protected `gig_viewer_replays` and inherit outcome visibility. Clients have SELECT only, while insert/update/delete policies deny normal users. Service-role generation claim grants remain revoked from anon/authenticated. Payloads include display names/roles already used for gig presentation and exclude auth IDs, hidden skills, tokens, raw rows, private attendance internals, and spectator access.

## Files changed

- `src/features/gig-experience/events/constants.ts`
- `src/features/gig-experience/events/schema.ts`
- `src/features/gig-experience/events/generator.ts`
- `src/features/gig-experience/events/__tests__/schema.test.ts`
- `supabase/functions/_shared/gig-viewer-replay/constants.ts`
- `supabase/functions/_shared/gig-viewer-replay/schema.ts`
- `supabase/functions/_shared/gig-viewer-replay/generator.ts`
- `supabase/migrations/20260711190000_phase_5_pr_10_replay_generation_recovery.sql`
- `docs/gigs/implementation/PHASE_5_PR_10.md`
- `docs/gigs/implementation/PHASE_5_REVIEW.md`
- `docs/gigs/LIVE_GIG_IMPLEMENTATION_ROADMAP.md`
- `docs/gigs/LIVE_GIG_EXPERIENCE_PLAN.md`
- `docs/gigs/LIVE_GIG_SYSTEM_AUDIT.md`

## Tests

Added Vitest coverage for schema compatibility and payload guardrails. `npm run typecheck` passed; the targeted Vitest command could not execute because dependency installation failed before `vitest` was available in `node_modules`.

## Known limitations

- No audio, public spectator mode, player reactions, 3D, physics, custom venue art, or bulk legacy replay backfill.
- Detailed mistake/recovery/equipment/singalong/solo events remain unsupported until server-authoritative event sources exist.
- Database clean reset, SQL harnesses, browser, mobile, and automated accessibility gates remain unverified in this container.

## Phase 5 status

**Complete with accepted limitations**, contingent on running the unverified release gates in a provisioned environment.

## Beta-readiness decision

**Ready with prerequisites**:

1. install dependencies and rerun typecheck plus lint/build/unit tests;
2. run Supabase start/reset/migration list and Phase 5 SQL harnesses;
3. run browser smoke/mobile/a11y coverage against deterministic fixtures;
4. verify no P0 failures from those gates.

## Recommended next area

Gig preparation improvements are likely the highest-value next area once the verification prerequisites pass, because the completed replay is now coherent while pre-gig planning still has more direct player agency opportunities.
