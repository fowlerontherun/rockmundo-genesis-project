# Roadmap

- [ ] Festival guest solos: friendly same-edition bands invite and accept a named guest, protect booking locks, award completion-only XP and optional Twaater posts; test and update version.

- [x] Seasonal festival stages: edition-date scenery, city seasonal weather and fresh runtime overrides; cosmetic only, with lightweight and reduced-motion support.
- [x] Verify seasonal rules (30 tests), all four stage seasons and mobile view without page errors or overflow; version 1.1.819. Signed-in real edition weather unverified with the external account service.

- [x] Festival wizard: guided founding and annual-edition steps, persistent themes/motifs, shared artwork and poster colours, protected saving and review; version 1.1.818.
- [x] Festival wizard: 55 focused tests passed across overlapping runs; desktop/mobile visual fixture completed theme selection, review and saved-result feedback without page errors or horizontal overflow. Build OK; changes committed.
- [ ] Festival wizard: real signed-in founding/annual save verification is blocked by the external unmanaged account service; browser fixture checks are not authenticated gameplay verification. New migrations introduced no remaining security warnings; existing project-wide findings remain separate.

- [x] Social continuation: corrected band-chat account/character IDs and malformed invitation UUID validation; added character-scoped room access, ended-scene write guards/history, message retry and live friend/invite refresh.
- [x] Social continuation: personal Twaater recap drafts without scene details; 81 focused tests passed, version 1.1.812. Browser page has no errors; authenticated message/scene/publishing journeys remain unavailable with external unmanaged auth.

- [x] Festival repair: protected counteroffers and booking-specific saved setlists/backstage choices; legacy contracts remain isolated.
- [ ] Festival repair: live gates and performance effects blocked by missing canonical crowd/tick/action infrastructure; availability fails closed, final-local-day simulation guard restored.
- [x] Festival repair: validate financial inputs; refresh readiness; show real act names, currencies and booking details.
- [x] Festival repair: stale history/attendance recovery, shared mobile ticket/check-in page and persistent Festival Mode navigation.
- [x] Festival repair: 46 focused tests and 3 route tests pass, active inventory certified, version 1.1.806. Full suite: 793 pass, 27 failures remain. Authenticated transactions unavailable with external unmanaged sessions; no claim of complete live performance restoration.

- [x] Extend graphics refresh across shared game headings, panels, tabs and hub artwork; preserve dense layouts and gameplay. Missing artwork uses destination icons.
- [x] Verify Music, Character, Skin Store and Skills pages with no page errors; four hub navigation tests pass, mobile companion has no horizontal overflow, version 1.1.804. Signed-in data-rich pages and every individual page are not exhaustively verified with external account sessions unavailable.

- [x] Improve clothing collection pictures and instrument store graphics; nine shared-renderer tests pass, desktop/mobile card controls verified, version 1.1.803. Local screenshot checks used original images because localhost does not serve hosted asset URLs; hosted delivery and signed-in store journey remain unverified.

- [x] Continue clothing detail improvements with smaller surface-bound laces and eyelets on genre-pack footwear.
- [x] Improve stage guitar/bass fret coverage, nut, inlays, saddles and saved hardware colours without changing crafting rules.
- [x] Run clothing/instrument tests (25 pass), review desktop/mobile model previews with no page errors, and update version 1.1.802. Signed-in equip remains unverified because external account sessions are unavailable.

- [x] Review the production avatar creator and shared clothing fit; improve genre pack discovery and stage previews.
- [x] Add four genre packs with twelve published garments through the existing paid-set catalogue, preserving ownership and stage compatibility.
- [x] Test garment validation and shared rendering (40 tests pass), review desktop/mobile previews, update version 1.1.801 and commit. Authenticated purchase/equip checks unavailable with external account sessions; older wardrobe not fully clipping-certified.

- [x] Fix university completion at the saved duration and add one-time completion XP: four overdue courses repaired, zero remain overdue, 16 tests pass, version 1.1.800. Signed-in course receipt display remains unverified because external account sessions are unavailable.

- [x] DB reconciliation phases 2–3: classify scripts vs live schema, freeze known date/duplicate issues, report in docs/db.
- [x] Weekly band payroll rebuilt on band balance and switched on (1.1.781).
- [x] Luthiery shop browsing + recruitment slot release applied (1.1.782).
- [ ] DB reconciliation phase 4–6: per-feature deploy/merge/retire decisions — waiting on user (staging copy? keep achievement engine, band proposals, balance versioning?).

- [ ] Add TV-studio camera variety and replay-time camera movement without changing archived broadcast cues.
- [ ] Add safe studio performer movement, verify stage/equipment constraints and visuals, and update version history.

- [x] Add withdrawal for pending real-band festival invitations and verify permissions, status updates and version history. 17 focused tests pass; build OK and anonymous server access denied. Live-account verification is unavailable with the external account service; three older festival source-expectation tests still fail.

- [x] Review maintained translations and translate mobile navigation and character switching.
- [x] Add mobile character and language controls using the existing account switching flow.
- [x] Verify translation parity and mobile switching; update banner and version history. All 69 focused tests pass and French controls work in the preview; authenticated end-to-end switching is unavailable with the project's external account service.

- [x] Improve luthiery guitar/bass silhouettes and correctly aligned strings, frets, pickups and hardware.
- [x] Add compatible workshop component variations while preserving existing crafted instruments and crafting rules.
- [x] Verify workshop and new silhouette tests and visuals; update the banner version and version history. The broader musician suite reports existing grip/pose failures, including unrelated drums and acoustic instruments; these are not certified by this change.

- [x] Review the existing Top of the Pops production and broadcast foundations.
- [x] Approve the broadcast-quality roadmap and acceptance gates.
- [x] Phase 0: typed calls, lifecycle checks, health monitoring and immutable broadcast contract.
  - [x] Typed show calls, production-health panel, lifecycle harness.
  - [x] Fixed episode running sheet with deterministic checksum, rights record and production states.
  - [x] Store the running sheet against the episode in the database (admin save/read RPCs, immutable once rendered/published) with API tests.
  - [x] Page-level player/admin render tests for the Top of the Pops pages.
- [x] Phase 1: in-game television presentation polish and accessibility.
  - [x] Widescreen 16:9 programme frame with action/title safe areas for all overlay graphics.
  - [x] Deterministic caption track (presenter, chart graphics, audience) with WebVTT export and a subtitles toggle.
  - [x] Broadcast audio mix balance (song bed, presenter, audience) and end credits sequence.
  - [x] Loading and recovery states for the in-app broadcast viewer (audio preparing, retry on failure).
- [x] Phase 2: deterministic offline rendering and MP4 export.
  - [x] Deterministic render plan from the running sheet (shot list, chapters, poster/thumbnail marks, delivery filenames, loudness targets).
  - [x] Quality-control contract (duration, resolution, frame rate, codecs, loudness, true peak, chapters) with failure reporting.
  - [x] Render queue in the database (request, claim, complete, fail, cancel) with admin-only access and one active job per episode.
  - [x] Admin render panel with planned length, chapters, progress, downloads and failed checks.
  - [x] Render worker contract documented (`docs/totp-render-worker.md`).
  - [x] Headless GitHub Actions render worker produces the MP4, poster, captions and chapter files through an OIDC-authenticated Supabase broker.
- [x] Phase 3: production control room, rehearsal and release gates.
  - [x] Graded preflight report (blockers, warnings and notes) across running sheet, acts, audio, rights, runtime, export, automation and compliance.
  - [x] Deterministic full rehearsal render uses the exact frozen manifest; QC pass is required before production sign-off, master render and external publishing.
  - [x] Per-act segment preview/re-render controls support editorial review after replacing rights or presenter assets.
  - [x] Single control-room surface combines health, running sheet, contract assets, compliance, rehearsal, render and delivery status.
  - [x] Audit history covers checks, worker-owned rehearsals/renders, sign-offs, warning acknowledgements, replacements, re-renders and publication actions.
  - [x] Blocking preflight failures cannot be overridden; non-blocking acknowledgements require a reason and remain visible.
  - [x] Dedicated Phase 3 release suite covers database gates, admin journey, renderer/failure recovery, production build and browser visual render smoke.
- [x] Phase 4: YouTube upload and scheduled Premiere.
  - [x] Episode publication records (title, description, tags, visibility, premiere time, source master, YouTube video id, state).
  - [x] Server-side upload function with resumable upload, Drive master reading and scheduled premiere support.
  - [x] Control room publishing panel with prefilled listing, publish now or schedule premiere, and failure reporting.
  - [x] Uploads handled manually by the user; stored channel credentials not required.
- [x] Phase 5: rights, moderation, safety and accessibility hardening.
  - [x] Player broadcast permission page with scopes, plus withdrawal.
  - [x] Deterministic screening report (permission, wording, music rights, subtitle readability, takedowns) saved per episode.
  - [x] Takedown records (remove / replace / mute) that never alter game settlement.
  - [x] Export and publish gated on a clean screening report matching the current running sheet.
- [ ] Phase 6: redundant RTMPS live transmission.
- [ ] Phase 7: production operations, analytics and audience growth.