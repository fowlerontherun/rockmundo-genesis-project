# RockMundo — DJ & Nightclub Performance Overhaul
## Detailed Implementation Plan · v1 · 17 October 2026

**Tracking epic:** GitHub #4258  
**Related implementation issues:** #4246 (scheduled DJ gigs), #4247 (3D DJ viewer), #4248 (mixing minigame), #4234 (atomic settlement), #4256 (practice audio write security), #2002 (crowd audio).  
**Completed source foundation:** PR #4257 was merged on 17 October 2026.

**Plan status:** Proposed scope and sequencing. Creating this document does not change the live game, database, or payment economy.

## 1. Product vision

Turn DJing into a genuine solo music career alongside normal RockMundo gigs. A player should:

1. Discover a nightclub in their current city and see bookable DJ opportunities.
2. Browse their recorded songs, opt-in RockMundo artists' tracks and curated admin-uploaded music with actual playable audio.
3. Build a DJ set and rehearse real song-to-song transitions on two decks.
4. Book a real game-calendar club slot, with travel and schedule conflicts enforced.
5. Arrive and perform in the existing gig viewer, in a nightclub with DJ booth, decks and a dancing crowd.
6. Optionally play Beatmatch & Drop at key transitions to demonstrate additional timing, beatmatching and mixing mastery.
7. Receive a final gig-style report: crowd response, attendance, local fans, fame, skill XP, club reputation and agreed pay, settled exactly once.
8. Build residencies and a longer-term DJ career; let club owners run events and hire players.

The **same canonical DJ performance** must drive the calendar, audio plan, player controls, viewer, audience, final outcome, history and analytics. No independent client-side reward flows.

### Product boundaries / non-goals

- No actual performance earnings from free-form mixer practice.
- No automatic public sharing or third-party distribution of audio without creator/admin rights.
- No promises of professional key-lock/time-stretch in the initial mixer; the current browser speed control changes pitch.
- No player-controlled reward amounts, audience numbers or arbitrary score submissions.
- No need to rebuild band gigs, Supabase auth, the 3D renderer or the entire existing song library.
- Advanced remix exports, collaborative DJ duos, full song production/DAW workflows and livestreamed spectator audio are post-MVP.

## 2. Verified baseline and known gaps

| Existing foundation | State verified 17 October 2026 | Work required |
|---|---|---|
| PR #4257 two-deck practice mixer, DJ library and admin screen | Merged to repository | Test live client after migration; extend engine and UX |
| Live database DJ catalogue | Missing public.dj_audio_tracks, songs.dj_use_allowed and private dj-tracks bucket; migration history lacks 20261017214000 | **Phase 0 production rollout blocker** |
| Practice-track legacy admin upload | Existing DB and Storage policies allow any authenticated user to write | Correct in #4256; keep new DJ library protected |
| Nightclub performance action | Client-side immediate roll and separate writes | Replace with booked authoritative session (#4234/#4246) |
| DJ performance results | Stores fans_gained but current flow does not create reliable city-level DJ following | Canonical fan and earnings ledger |
| Game schedule | player_scheduled_activities and existing travel/class projections | Add DJ performances and check all overlap sources |
| 3D stage | GigStage3D / ConcertScene, club archetype, turntablism role already exist | Add DJ mode, decks, animations and dancefloor |
| Crowd/audio | Shared gig viewer with ambience and replay | Reuse; build event-driven DJ dance response; coordinate #2002 |
| Audience demand | New market-led gig ticket demand uses band city/country following | Adapt approach for solo-DJ local demand, not direct band table reuse |

As of the live database check, there is no obvious dedicated profile-city DJ fan table. Design the solo DJ following schema after confirming the canonical character/fan model. Do not store solo fan gains in band-city tables without explicit band association.

## 3. Architecture and ownership contracts

**Client layer:** Nightclub discovery, bookings, set preparation, free practice, real-time mixer input, live 3D view and reporting. Clients may submit bounded choices and a compact sequence of player interactions; they cannot settle outcomes.

**Audio layer:** Shared track source adapter (game song / admin track), permission resolution, audio asset version/availability, playback controller, beat metadata, mixed audio output. Audio availability and licence status can change between set preparation and showtime; handle revocation safely.

**Server authority:** Validates active character/account, location, time slot, setlist rights, venue, equipment, energy, schedule, game clock, ownership/approval, minigame attempt constraints, crowd demand, incident simulation, outcome and atomic settlement.

**Read-only presentation:** Live viewer and replay consume an immutable session snapshot + authoritative event timeline. Audio/crowd rendering does not mutate funds, fame or XP.

**Ownership:** Auth user and active profile are distinct. Every player mutation must verify the active character belongs to the authenticated user. Admin permissions are enforced in RLS/Storage, not just by UI routes.

**Event contract:** Introduce versioned events for show start, song cue, blend start/end, sync/drop, crowd state, incident, result and completion. Persist only bounded gameplay evidence and selected metadata, not unlimited pointer movements.

**Reliability:** Idempotency key per booking attempt and settlement, uniqueness per completed session, server timestamps, row locks or equivalent atomic constraints, durable event/error diagnostics. Treat refresh/disconnection as normal lifecycle events.

## 4. Phase overview and gates

| Phase | Scope | Priority | Depends on | Exit / player-visible milestone |
|---|---|---|---|---|
| 0 | Production baseline, migration, security | P0 blocker | Merged PR #4257 | New practice mixer and admin catalogue work with RLS tests |
| 1 | Music catalogue, audio readiness and rights | P1 | 0 | Real playable, searchable tracks with accurate metadata and consent |
| 2 | Robust two-deck mixing engine | P1 | 1 | Smooth usable browser/mobile mixing practice |
| 3 | DJ setlist preparation and contracts | P1 | 1 | Prepared set can be saved and validated |
| 4 | Game-calendar nightclub bookings and lifecycle | P1 | 0, 3 | Actual DJ performance appears on schedule |
| 5 | Authoritative performance, crowd economics and settlement | P0/P1 | 4, #4234 | No double payouts; crowd and fans reflect venue/popularity |
| 6 | 3D nightclub scene and show replay | P1 | 4, 5 for real-world events | DJ on decks, fans visibly dancing, stable replay |
| 7 | Beatmatch & Drop scored minigame | P2 | 2, 5, 6 | 3–5 interactive transitions with bounded verified influence |
| 8 | DJ career, owner features and event ecosystem | P2 | 4–7 | Residencies, offers, analytics and club operations |
| 9 | Full certification, telemetry and staged rollout | Release gate | Each shipped phase | Safe staged production release with rollback |

Phases 1 and 3 can overlap once schema contracts exist; visual prototyping in Phase 6 can run in parallel with backend Phases 4–5. **Do not enable paid DJ performances before Phase 5 passes.** Unit, security and regression testing are required at every phase, not deferred to Phase 9.

---

## Phase 0 — Stabilise what has merged and secure all writes
**P0 / immediately required. Related: #4257, #4256, #4234.**

### Tasks
- [ ] **DJ-0001 · Reconcile migration state:** Compare merged DJ migration 20261017214000 with live schema and existing October migration ledger. Prepare safe ordered deployment, compatibility assessment and explicit rollback.
- [ ] **DJ-0002 · Apply catalogue schema and bucket:** Create DJ catalogue, songs opt-in column and private audio bucket through approved migration workflow. Confirm schema, indexes, functions, RLS, Storage policies and Data API grants in deployed environment.
- [ ] **DJ-0003 · Negative authorization tests:** A non-admin must fail DJ asset INSERT/UPDATE/DELETE, Storage upload/upsert/remove and reads of unpublished catalogue entries. Admin can upload and publish. A signed URL must not be issued for inactive/uncleared files.
- [ ] **DJ-0004 · Verify player audio paths:** Test own recorded song and opt-in track selection, simultaneous Deck A/B play, seek, cue, tempo, crossfade, stop on exit; check Chrome/Firefox/Safari where available and mobile browsers.
- [ ] **DJ-0005 · Fix legacy practice audio policies:** Move old practice_track_audio and practice-tracks Storage writes to admin-only policies; retain necessary player read permissions. This is #4256, not a rewrite of practice gameplay.
- [ ] **DJ-0006 · Freeze unsafe instant-set expansion:** Audit both DJ slot buttons and #4234. Do not add new payouts/features onto the existing independent browser writes. Gate or retire instant DJ reward path during cutover without losing historical records.
- [ ] **DJ-0007 · Admin runbook:** Upload, unpublish/takedown, key permissions, support errors, post-deployment validation and monitoring. Log audit actors and timestamps.
- [ ] **DJ-0008 · Consent integrity:** Review band-member and song-owner update policies so a collaborator cannot grant DJ use of another creator's work without proper authorization.

### Exit criteria
- Deployed table/column/bucket exists and route loads successfully; tests pass using an ordinary account and admin account.
- No ordinary player can alter admin audio catalogue or legacy practice files.
- No regression to SongPlayer, stage practice, AI audio generation or gig viewing.
- Real audio mixing remains *practice only*, clearly labelled with no rewards.

## Phase 1 — Rights-aware DJ music catalogue and audio preparation
**P1. Related: #4257 and Phase 0.**

### Tasks
- [ ] **DJ-0101 · Unify track API:** Introduce a stable source descriptor: source_type (game_song/admin_track), source_id, title, artist, genre, duration, availability, audio version, share scope, BPM/key and optional beat grid. Avoid persisting raw signed URLs in setlists.
- [ ] **DJ-0102 · Artist credit:** Resolve game song performing band/artist properly rather than placeholder text. Support player-only tracks and aliases; do not expose private account identifiers.
- [ ] **DJ-0103 · Consent/usage permissions:** Distinguish own practice, other-player DJ reuse, and public paid nightclub performance where the rights model needs it. Store consent decision/history and validate at playback/booking time. Default to disallowed; allow revocation.
- [ ] **DJ-0104 · Admin ingest:** File extension/content validation, size ceiling, checksum/deduplication, structured metadata, immutable replacement/versioning, soft hide vs takedown, audit log, safe orphan cleanup. Validate MIME/codec on the server, not just client filename.
- [ ] **DJ-0105 · Audio normalisation and analysis:** Server/job-side or admin-side validated duration, playable codec, sample rate, loudness/peak, BPM estimate, beats/downbeats, phrase boundaries and musical key where confidence permits. Manual admin BPM/key override. No automatic claims for low-confidence metadata.
- [ ] **DJ-0106 · Search and discovery:** Search title, artist, genre and BPM; filters for Mine / Shared RockMundo / Club Library, playable-only, quality/energy and compatibility recommendations. Pagination instead of fixed small limits.
- [ ] **DJ-0107 · Audio access lifetime:** Private object signing, expiry renewal, rights revocation, external game audio fallback/CORS checks, browser decoding/buffering errors, removed asset when already in setlist.
- [ ] **DJ-0108 · Rights accounting:** Confirm recording/DJ-play royalty model and audio-use licence with project policy. If royalties are later enabled, design a separate idempotent play-attribution ledger; never silently create financial obligations.

### Exit criteria
- Both libraries reliably offer real audible tracks and accurate credits; hidden/unlicensed/inaccessible tracks cannot be newly selected or played by unauthorized users.
- BPM/key are labelled as measured, manually set or unknown; genre mismatch never silently changes user-chosen songs.
- Publishing and takedown are logged, and takedown invalidates future playback authorization.

## Phase 2 — Two-deck mixer engine v2 (practice experience)
**P1. No game rewards.**

### Tasks
- [ ] **DJ-0201 · Shared playback clock:** Align two decks and visual beat grids to a monotonic audio clock. Use Web Audio gain buses with CORS-compatible sources and robust HTMLMediaElement fallback if remote game audio cannot be wired into Web Audio.
- [ ] **DJ-0202 · Deck transport:** Play/pause, cue/set hot cue, seek, load/unload, gain, bounded pitch/tempo adjustment; avoid stale playback if a track changes during load.
- [ ] **DJ-0203 · Crossfade/audio headroom:** Smooth equal-power transitions without gain jumps; meter peak output and prevent clipping. Independent preview/cue monitoring if device routing supports it; otherwise accessible cue-by-visual and sequential monitor controls.
- [ ] **DJ-0204 · Beatmatch workflow:** Detect/show track BPM when reliable; phase/beat-grid alignment and manual nudge. “SYNC” matches tempo only where safe, with honest messaging that phase/key lock may be unavailable.
- [ ] **DJ-0205 · EQ/effects second tier:** Optional low/mid/high bands, filter, transition FX and limiter. Start simple; advanced controls unlock visually without making playback inaccessible.
- [ ] **DJ-0206 · Waveforms and phrasing:** Lightweight precomputed waveform peaks and cue/drop/phrase markers. Never require expensive decoding of long files on low-memory devices.
- [ ] **DJ-0207 · Mobile and accessibility:** Large targets, portrait layout, one-handed simplified mode, keyboard actions, screen-reader labels, reduced motion, no-audio visual timing, latency calibration and a short tutorial.
- [ ] **DJ-0208 · Lifecycle reliability:** Unlock audio on user gesture, stop all active sources on close/navigate, handle mobile background/visibility/resume, suspended AudioContext, expired signed URLs, buffering, audio errors and retry.
- [ ] **DJ-0209 · Performance/QA:** Measure user gesture→audio start, buffer underruns, deck drift and clipping; never mix sounds above safe gain, never leave audio playing after close.

### Exit criteria
- Two distinct real tracks can be continuously blended on supported browsers; cue/reseek works without ghost audio.
- Stable on mobile, gracefully falls back when Web Audio/CORS fails, and never grants progression for practice.
- Fallback makes feature usable if optional beat metadata is missing.

## Phase 3 — Prepare, validate and save DJ setlists
**P1. Can run alongside parts of Phase 2.**

### Tasks
- [ ] **DJ-0301 · DJ setlist schema:** Separate or extend existing setlist model; support ordered items referencing exactly one game song or one curated admin track, owning profile, target club, status/version, set duration and metadata snapshot. Do not conflate nightclub ID with the gigs.venue_id FK.
- [ ] **DJ-0302 · Builder UI:** Add/reorder/remove, select source library, show title/artist/duration/BPM/key, choose cue points/intro/outro and approximate playable segments. Offer genre/tempo/energy-flow suggestions without forcing them.
- [ ] **DJ-0303 · Set-duration planner:** Validate contracted time, minimum playable audio, repeats, too-short/too-long sets and silence gaps; support short pieces while showing effective runtime.
- [ ] **DJ-0304 · Permissions and snapshot:** Recheck track rights and audio readability on save, booking, check-in and show start. Lock signed IDs, titles and audio version descriptors at start, not ephemeral URLs.
- [ ] **DJ-0305 · Practice rehearsal:** Load an upcoming set into the two decks; allow unscored play-through; optional preparation/readiness benefit based on genuine scheduled practice once gig lifecycle exists.
- [ ] **DJ-0306 · Library disruptions:** Show blocked items with clear replace/remove actions; handle removed audio before a gig without corrupting old reports/replay provenance.
- [ ] **DJ-0307 · Readiness tests:** Mixed source tracks, missing audio, permissions revoked, duplicate song, set duration, two characters using separate lists, stale version changes.

### Exit criteria
- Save/reopen a prepared playlist; book it against a club; server can lock a consistent track/rights snapshot.
- Future gig does not rely on mutable playlist rows or expiring public audio URLs.

## Phase 4 — Book DJ performances like regular gigs
**P1. Existing issue #4246.**

### Tasks
- [ ] **DJ-0401 · Booking data model:** DJ performance booking, candidate timeslot, performer profile, club/city, agreed fee, set duration, status, setlist ref, approval, start/end in canonical game time and audit timestamps.
- [ ] **DJ-0402 · Club slot generation:** Opening hours, event theme/genre, quality tier, fame threshold, capacity, availability, NPC/resident hold, recurring slots and optional owner approval.
- [ ] **DJ-0403 · Server-side availability:** Enforce overlap exclusions for DJ set, band gig, festival, university, reading/practice, work, recording, travel, health and other scheduled activity sources. Check actual travel/location at booking and start.
- [ ] **DJ-0404 · Calendar integration:** Add explicit dj_set activity type to player_scheduled_activities projection/UI, support reminders, route from schedule to club, and reliable game-clock timezone handling. Game event matching must stop using the device's real-world weekday.
- [ ] **DJ-0405 · Lifecycle RPCs:** Offer/request/approve/book/check-in/ready/start/resolving/completed/cancelled/missed/failed; validate performer identity, slot, location, energy, gear and setlist at each authorized transition.
- [ ] **DJ-0406 · Robust concurrency:** DB uniqueness or exclusion for simultaneous club+character booking, idempotent booking requests, cancellation rules/refunds/penalties, prevention of impossible double bookings.
- [ ] **DJ-0407 · UI migration:** Replace “Queue for DJ Slot” in both city/club surfaces with “Book DJ Set”, “Prepare Set”, “Perform” or view results based on status. Don't change social guest actions or the club chat.
- [ ] **DJ-0408 · Missed/absent handling:** Decide pre-agreed auto-play/simulate attendance or no-show consequences; keep outcome independent of viewer connection, but no-show must not equal a rewarded successful live appearance.
- [ ] **DJ-0409 · Existing history:** Keep older player_dj_performances readable and marked legacy; do not manufacture booked sessions for already completed records.

### Exit criteria
- A club slot cannot be double-booked; the same character cannot DJ and travel/study/perform at the same time.
- A confirmed DJ gig is visible in schedule, can be prepared/check-in/start/completed, and survives refresh/disconnect.
- **Financial payouts remain disabled until Phase 5.**

## Phase 5 — Authoritative DJ gig scoring, local fans and settlement
**P0 financial integrity / P1 gameplay. Existing #4234, #4246.**

### Tasks
- [ ] **DJ-0501 · Show-session evidence:** Persist server-validated session, immutable setlist, club, performer(s), readiness, equipment, time, crowd profile and bounded transition actions with calculation-version field.
- [ ] **DJ-0502 · DJ readiness/execution:** Adapt normal gig outcome weights to DJ/turntablism skill, relevant technical attributes, setlist flow, preparation, equipment suitability, energy/fatigue, genre fit and club quality.
- [ ] **DJ-0503 · Attendance/demand:** Derive actual dancers from club capacity, local/country fandom and fame, reputation, genre, promotion, event and cover charge. Reuse market-led gig demand concepts but implement solo DJ inputs explicitly and independently of band_city_fans.
- [ ] **DJ-0504 · Audience dynamics:** Track arrival/occupancy, energy, satisfaction and momentum across songs and transitions; genre changes and drops affect audience, as do fatigue and technical mistakes. Never visually or financially exceed capacity.
- [ ] **DJ-0505 · Solo/local followers:** Determine existing character-city fan model or create profile_city_dj_fans with accurate paid/organic growth and repeat attendance. Do not record fans_gained only in a report while leaving the canonical fan population unchanged.
- [ ] **DJ-0506 · Atomic settlement:** Single authenticated server transaction or privileged tightly-scoped service validates session and settles fee, energy, profile fame, club reputation, DJ XP, fan gains, club books, event bonuses and all ledger events **exactly once**. Retry returns same canonical outcome.
- [ ] **DJ-0507 · Financial reconciliation:** Separate door intake/club owner economics, contracted DJ payout, perks and any royalties; avoid money creation through unrelated direct profile updates. Support insufficient balance and refunded/cancelled gigs.
- [ ] **DJ-0508 · Safe legacy cutover:** Remove direct client-side reward path after new system is live; preserve legacy history and prohibit replaying legacy sets into new ledger.
- [ ] **DJ-0509 · Reports/telemetry:** Persist overall grade, execution, mix quality, crowd curve, attendance, setlist song events, fame, fan change, XP, fee, alerts and deterministic replay metadata.
- [ ] **DJ-0510 · Automated gates:** Concurrent completions, duplicate requests, RLS/user vs selected character, stale balances, rollback after each induced write failure, missed show, cancelled show, bad inputs and demand caps.

### Exit criteria
- One booked DJ appearance produces at most one accepted result and one ledger application; no phantom fans or payments.
- Tests compare a huge celebrity in a tiny club vs low-fame beginner, capacity extremes, promotion strength and poor/exceptional performance.
- Results match server snapshot and accounting totals after reconnect.

## Phase 6 — Build nightclub-specific live 3D gig presentation
**P1. Existing #4247 and #2002.**

### Tasks
- [ ] **DJ-0601 · Shared viewer adapter:** Add explicit dj_club scene mode with nightclub session DTO; reuse GigViewerShell/GigStage3D/ConcertScene, playback controls and canonical event timeline. Do not fork a separate independent gig renderer.
- [ ] **DJ-0602 · Nightclub layout:** DJ booth at front/back by venue, pair of decks and mixer, sound system, dancefloor crowd zones, bar, VIP booth, lasers, haze, LED visuals and appropriate club camera masks.
- [ ] **DJ-0603 · DJ avatar animations:** Active character's outfit and face, behind-the-decks posture, headphone cue, knob/fader/jog gestures, launch pad trigger, arms-up hype and reacting to failures/drops. Map saved events to animation, not visual randomness.
- [ ] **DJ-0604 · Dancing crowd behaviour:** Beat-synchronised bounce, sway, dancing, jumping, cheering, hands-up, sparse and packed configurations, group variation based on audience energy, genre, attendance and density. Respect representative crowd instance caps.
- [ ] **DJ-0605 · Music and ambience:** One audio master; DJ mix source plus controlled crowd/room audio buses. Add cheers on drops and atmospheric reactions, but do not collide with normal concert/TOTP crowd audio (#2002).
- [ ] **DJ-0606 · Cameras and UI:** Club-wide, DJ closeup, overhead dancefloor, behind-DJ and spectator camera; in-view song metadata, BPM, energy, occupancy and mix quality. Spectators never receive authorized mixing/reward controls.
- [ ] **DJ-0607 · Deterministic replay:** Persist selected asset/version, event timings, outfit snapshot and audience curve; replay is read-only and survives future cosmetic/track changes as far as rights permit.
- [ ] **DJ-0608 · Accessibility/performance:** Reduced-motion/strobe-safe modes, quality tiers, low-end/mobile FPS caps, fallback timeline if WebGL fails, audio stops on exit, no reward logic attached to rendering.
- [ ] **DJ-0609 · QA demo fixtures:** Admin stage preview with small/large occupancy, unknown audio, no attendees, packed club, audience failures, high energy, DJ duo placeholder and deterministic replay.

### Exit criteria
- Player avatar visibly DJs with decks and crowd dances responsively; no imaginary full band.
- Crowd matches stored attendance and event timing; spectator mode works; failure to render never affects outcome.
- No rapid unsafe flashes, and mobile fallback retains usable controls.

## Phase 7 — Beatmatch & Drop, easy to play / hard to master
**P2. Existing #4248.**

### Gameplay sequence
- **Cue:** Tap to cue incoming track near next musical bar/downbeat.
- **Beatmatch:** Align tempo and beat phase using nudge/slider; show a forgiving beginner beat grid.
- **Crossfade:** Smoothly blend Deck A to B during a highlighted phrase. Intro/outro alignment increases grade.
- **Drop:** Time optional energy drop and bass swap on a musical landmark.
- Repeat roughly **3–5 transitions per DJ show**, with a short tutorial; actual show duration remains authoritative, not equal to minigame run time.

### Tasks
- [ ] **DJ-0701 · Timing engine:** Versioned downbeat/phrase markers, high-resolution audio-time measurement, calibration and deterministic training fixtures (real rights-cleared tracks or generated beat grids).
- [ ] **DJ-0702 · Beginner controls:** One cue action, BPM guidance, simple crossfader and DROP, large touch targets, high-contrast accessible markers, optional assist.
- [ ] **DJ-0703 · Mastery controls:** More precise cue windows, beat-grid phase, manually timed EQ/bass transitions, phrase alignment and combo streak; increase challenge by skill/club tier rather than random input spam.
- [ ] **DJ-0704 · Scoring:** Separate cue accuracy, phase sync, blend smoothness, phrase match and crowd-drop timing. Provide transparent feedback without punitive grind.
- [ ] **DJ-0705 · Bound economic influence:** Example target: preparation/character skill/gear ~70%, crowd/venue/track fit ~20%, player mix execution bounded to the remaining ~10 score points. Tune through simulation; final server authority and caps override client claims.
- [ ] **DJ-0706 · Action verification:** Server-issued attempt ID and track/beatmap version; accept bounded compact action summaries with impossible timing/spam checks, no trusted client final score, strict duplicate/completion idempotency and rate limits.
- [ ] **DJ-0707 · Optional/auto mode:** Players who cannot or choose not to play still complete eligible booked gigs via skill-weighted auto execution. No accessibility penalty or artificially failed show; successful manual execution can add bounded optional upside.
- [ ] **DJ-0708 · Live crowd integration:** DJ action quality maps to persisted score events and dancefloor animation; the client visual preview cannot change canonical crowd/rewards until the server accepts the result.
- [ ] **DJ-0709 · Tests:** Boundaries, latency, idle/no input, assistance, hard/soft BPM differences, suspended app, disconnect, double-submit, tampered scores, keyboard/touch and screen reader.

### Exit criteria
- Anyone can complete a basic mix; mastery is measurable and repeatable at higher difficulty.
- Offline/latency/failure routes degrade to an honest neutral/auto outcome instead of extra payouts.
- No musical input, animation or retry can award unrestricted rewards.

## Phase 8 — DJ career, club ownership and ecosystem
**P2. Can progressively follow a stable booked-gig MVP.**

### Tasks
- [ ] **DJ-0801 · Career progression:** DJ-specific skill XP, familiarity, local following, tier/rank, successful sets, favourite genres and milestones; support both solo artists and existing bands' DJs without merging their finances.
- [ ] **DJ-0802 · Residencies and offers:** Club manager/NPC offers, repeat slots, guaranteed vs performance-based pay, show history and contracts with cancellation terms.
- [ ] **DJ-0803 · Club owner operations:** Owner can propose/approve DJ slots, budget fees, set lineups/themes, hire staff, promote events and view profitable/poor show returns; never arbitrarily grant performer cash.
- [ ] **DJ-0804 · Nightclub event integration:** Genre nights, competitions, special guest nights, VIP, modifiers and club reputation anchored to canonical game calendar, not device calendar.
- [ ] **DJ-0805 · Equipment and cosmetic progression:** Deck upgrades, mixers, controller skins and DJ booth visuals with capped technical bonuses. Avatar clothing and event cosmetics display on stage.
- [ ] **DJ-0806 · Player social and discovery:** Upcoming DJ listings, club attendance, favourite DJs, ticket/guestlist visibility if designed, social announcements and friend spectating.
- [ ] **DJ-0807 · Achievements and history:** First DJ set, perfect transition, residencies, memorable drop, club legend, venue tours; verify one-time award idempotency.
- [ ] **DJ-0808 · Admin operations:** Catalogue health, missing/unlicensed assets, invalid beat metadata, stuck bookings, settlement exceptions, replay diagnostics and aggregate engagement KPIs.
- [ ] **DJ-0809 · Balance tuning:** Fame/XP/cash/fan earnings against normal gigs, overnight activity and repeated sessions; stop exploitative repetition and prevent overpowered equipment purchasing.

### Exit criteria
- DJ progression creates a believable repeatable career, club owners can hire DJs, and administrative interventions are auditable.
- Solo DJ income/fans do not duplicate band-gig rewards or conflict with existing club revenues.

## Phase 9 — Certification and controlled live rollout
**Must gate all production changes; no single large last-minute release.**

### Tasks
- [ ] **DJ-0901 · Feature flags:** Independently gate dj_audio_library, dj_mixer_practice, dj_booking, dj_live_scene, dj_minigame, dj_settlement and dj_owner_features. Use existing central feature-flag mechanism, not ad hoc local storage.
- [ ] **DJ-0902 · DB migration certification:** Reconcile version identity/timestamps and application order; pre/post-deploy SQL checks; rollback that preserves existing historical performances and audio records.
- [ ] **DJ-0903 · Authorization matrix:** Ordinary user, admin, club owner, selected multi-character profile, revoked licence and spectator for every route/API/RPC/Storage operation.
- [ ] **DJ-0904 · Full gameplay matrix:** No audio, unavailable audio, crossfade, rights revoked before show, clock boundary, travel conflict, booking race, cancellation/no-show, event modifiers, crowded/sparse venue, non-attendee and zero-capacity safeguards.
- [ ] **DJ-0905 · Transaction fault injection:** Fail after cash, fame, XP, fan record or reputation calculation; confirm atomic rollback or durable exactly-once retry, no false UI success and verified ledger balance.
- [ ] **DJ-0906 · Device / audio certification:** Android, iOS, desktop, WebKit/Chromium where available; browser user-gesture policies, WebAudio CORS fallback, background/resume, headphone routing, latency, battery/data use and clipping.
- [ ] **DJ-0907 · Renderer/replay certification:** GPU and fallback paths, density/LOD, beat-locked dancing, viewer close cleanup, reduced motion, screen-reader summary, accessibility and no rapid flashing.
- [ ] **DJ-0908 · Instrumentation and alerts:** Catalogue upload failures, signed URL failure, playback start failure, session stuck/late, duplicate settlement attempt, audience/capacity anomalies, audio underruns, drop scoring and crash telemetry. No sensitive audio credentials in logs.
- [ ] **DJ-0909 · Staged enablement:** Admin smoke cohort → internal/test players → limited clubs → all eligible clubs, with telemetry comparison and stop/rollback conditions for economics and rights.
- [ ] **DJ-0910 · Docs/support:** In-game DJ tutorial, owner/admin SOP, migration receipt, feature notes, legacy-history explanation, known browser limitations and operator incident plan.

### Hard release gates
1. No unauthorized admin media modification and no playable content lacking required usage rights.
2. No direct client-controlled profile economy writes from DJ actions.
3. No duplicate bookings, duplicate payouts or cross-character settlements under concurrency.
4. Nightclub show on calendar with verified conflict handling, and preserved outcome despite renderer/audio failure.
5. Audience occupancy, city-level fan creation and club fee/ledger calculations have deterministic reproducible tests.
6. Full regression tests leave normal band gigs, festival sessions, radio, recorded-song playback, TOTP, stage practice and club nightlife/social activities unchanged.

## 5. Proposed persistence boundaries

**Reuse:** city_night_clubs; nightclub_events; player_club_reputation; songs and licensed audio; player_scheduled_activities; game-clock services; ordinary gig readiness/outcome engines; current 3D viewer; club ownership and crew; authenticated user/profiles.

**Add only where necessary:**
- DJ performance booking/slot records with unique reservation identity and game-clock datetimes.
- DJ setlists and ordered typed items, immutable show-start snapshot and permission/audio version.
- DJ show sessions and bounded track transition events.
- DJ outcome + financial ledger / awarded-progress idempotency keys.
- Character-city following if no canonical solo-city fan table can be reused.
- Persisted minigame attempts and verified scores.
- Admin track asset processing state and audit/takedown log.

**Invariant:** Never insert a DJ session row that pretends a nightclub UUID is a venue UUID. Preserve an explicit club foreign key or a clean polymorphic venue model with validation.

**Suggested API operations:** browse_dj_slots, prepare_dj_set, book_dj_slot, check_in_dj_set, start_dj_session, submit_dj_mix_events, finish_dj_session, read_dj_replay and cancel_dj_slot. Names are design placeholders: implement functions only after reviewing existing gig RPC patterns and grants.

**Authoritative replay contract:** session/version, stable track descriptor, mixing events, crowd timeline, rendering seed, cosmetics/equipment snapshot and resolved rights status. Store no expiring signed URL as replay source of truth.

## 6. Dependency graph and PR slicing

**Critical path:**
- Phase 0 live schema/security → Phase 1 approved audio → Phase 3 valid setlists → Phase 4 bookings → Phase 5 idempotent settlement → launch gig-style DJ performances.
- Phase 2 mixer quality can advance alongside Phase 3 after Phase 1.
- Phase 6 scene scaffolding may begin alongside Phases 4–5 using approved fixtures; connect to canonical live state after Phase 5.
- Phase 7 mixing game can be prototyped after Phase 2, but does not grant rewards until Phase 5.
- Phase 8 club ecosystem follows the core gig loop.
- Phase 9 gates every deploy and final public enablement.

**Recommended independently reviewable PRs** (do not use a single risky mega-PR):
1. DJ audio migration reconciliation, legacy practice audio security and production gate (#4256).
2. Audio source/rights/analysis/metadata service and catalogue UX.
3. Mixer v2, accessible touch/keyboard and audio teardown.
4. DJ setlist schema, track snapshot and preparation UI.
5. DJ booking/game-clock/schedule conflict contract (#4246).
6. DJ server session + attendance/fan model + atomic settlement (#4234).
7. DJ nightclub 3D mode, audience animations, read-only replay (#4247).
8. Beatmatch & Drop score integration and anti-replay/anti-cheat tests (#4248).
9. Club owner/residency/event/achievement progression.
10. Certification, feature-flag enablement and operator diagnostics.

## 7. Prioritisation, scope and proof

### MVP player-visible release
**Must:** secured track catalogue, two playable decks, basic crossfade, setlist builder, scheduled DJ gig in calendar, server outcome, venue-capped attendance, reliable rewards, basic nightclub presentation and report.

**Strongly recommended next:** improved beat grid/waveforms, deep DJ booth animations/dancing crowd, 3–5-mix timing game, real-time soundscape, reputation + local DJ discovery.

**Later enhancements:** residencies, competitions, advanced FX/key-lock, equipment skins, co-DJs, live spectator mixing broadcast, official remix exports, licensed music royalties.

### Definition of done for *every* task
- Product behaviour documented and visible in the correct player/admin route.
- Validated authority, RLS and selected-character ownership where applicable.
- Schema migration with drift inventory and post-deploy verification when DB changes.
- Unit, integration and negative tests for success/error/retry; regression coverage for affected prior features.
- Mobile/desktop, reduced-motion and inaccessible-audio fallback considered.
- Feature flag, telemetry, operator error diagnostics and rollback where production behaviour changes.
- No false-success toasts or unresolved reward-state ambiguity.

### Risks and mitigations
| Risk | Mitigation / gate |
|---|---|
| Git merge precedes DB migration | Phase 0 verifies live shape before enabling feature; tolerant UI and explicit schema receipt |
| Unauthorized audio upload or consent changes | Admin/owner-only RLS and signed Storage, negative tests, revoke/takedown logs |
| Cross-origin WebAudio restrictions | Per-source compatibility checks, MediaElement fallback, no silent no-audio scoring |
| Non-deterministic tempo/beat analysis | Persist versioned beat grid, allow manual correction, mark unknown metadata |
| Audio missing on gig date | Start-time readiness validation, permitted replacement or neutral fallbacks; don't play revoked audio |
| Exploits via repeated DJ starts or fake minigame score | Authenticated server state machine, idempotent outcome, capped verified input modifier and rate limits |
| Fan and cash economy inflated by small clubs | Attendance capacity caps, market-led local demand, ledger accounting and simulation tests |
| Complex 3D harms mobile | Reuse LOD and quality settings; bounded representative crowds and data-only fallback |
| Legacy DJ history breaks | Read-only legacy report route, no backfilled synthetic payouts |
| Conflicts with gig/travel/calendar systems | Shared overlap checker, canonical clock, transactional reservation and broad regression tests |

## 8. Acceptance walkthroughs (QA scripts)

**Scenario A — newcomer:** A low-fame player opens a small club, has available licensed tracks, prepares a set, books a valid slot, sees it in Schedule, DJs using simple controls, completes and sees modest crowd/fan/XP returns. Cannot re-run the same payout.

**Scenario B — major DJ:** A famous city-local DJ books a small club and fills it rapidly; the crowd never exceeds capacity. A higher-quality larger club attracts more people, while a 100-person room cannot magically create tens of thousands of fans.

**Scenario C — cross-track mix:** Player cues their own recorded audio on A and a cleared admin song on B, aligns tempo by ear or supported BPM guidance, blends across the phrase and hears both tracks without major clipping. Different source types work in one set.

**Scenario D — scheduling conflict:** Player is travelling or attending university during a proposed slot. Both UI and server reject booking with actionable alternative times. A concurrently submitted second booking also fails safely.

**Scenario E — rights revoked:** Admin hides an uploaded song or owner withdraws DJ consent before check-in. A prepared list flags it; no new signed play is issued; an existing historical performance report remains readable without unauthorized audio replay.

**Scenario F — disconnect:** Device loses connection during an active set. Reopening shows the same session and timeline, and the final outcome settles once even if the viewer fails or the finish action is retried.

**Scenario G — adversarial:** A non-admin calls upload APIs directly, tampers score/fee/club/profile identifiers, submits the same attempt repeatedly, changes characters, or manually rewinds system time. All unauthorized actions are rejected; no cash/fame/fan anomaly.

**Scenario H — accessibility:** Player uses keyboard/screen-reader controls or silent/reduced-motion mode, or skips the minigame. They may complete eligible gigs and gain their normal character-skill outcome without being excluded from DJ career progression.

## 9. Sign-off checklist

- [ ] Product: club selection, authored music, booked time, performer, 3D dancefloor and results feel like normal RockMundo gigs with DJ identity.
- [ ] Security: RLS and Storage matrix reviewed with real non-admin and cross-character tests.
- [ ] Economy: gig completion is atomic, idempotent and reconciled.
- [ ] Audio: rights-cleared real song playback, usable deck mixing and reliable stop/recovery.
- [ ] Content: original artists credited, audio unavailable/withdrawn handled safely.
- [ ] Calendar: all DJ travel/education/booking overlaps tested.
- [ ] Experience: audience varies with venue occupancy, club fit, performance and track transitions.
- [ ] Game integrity: no avatar frame/minigame client action directly issues rewards.
- [ ] Rollout: admin smoke, production gates, telemetry thresholds, support runbook and rollback path ready.

**Implementation owner notes:** Keep #4258 as master tracker and #4246–#4248 / #4234 / #4256 / #2002 as linked technical workstreams. Add small follow-up issues for independently testable tasks where useful, without duplicating existing P1 bugs. Revalidate actual repository and deployed DB before each phase; this is a plan, not an assertion that unbuilt objects already exist.
