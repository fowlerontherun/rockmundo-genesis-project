# Top of the Pops: broadcast-quality roadmap

## Review summary

The current feature is a strong **in-game television simulation**, not yet a broadcast production pipeline.

Already in place:
- Deterministic UK-chart selection, invitations, London check-in, running order, stages and presenter copy.
- Automated five-minute lifecycle checks that lock the show, open its broadcast window, settle performances and create immutable archives.
- A reusable 3D studio with four performance zones, planned camera shots, audience reactions, chart graphics, continuity, intro media and archived outfits.
- Full-episode playback, live-window spoiler gating, admin dry runs, production-media uploads and a release-health database check.
- Unit coverage for running order, playback timing, camera pacing and several supporting rules.

Main gaps before external release:
- The “live” programme is currently assembled and timed inside each viewer’s browser; no canonical video file is rendered.
- Timing uses browser clocks and separate audio elements, so it is not suitable as an exact frame/audio master.
- Presenter fallback speech varies by device and cannot be used in a final broadcast master.
- There is no render queue, MP4 validation, captions, loudness mastering, thumbnail package, YouTube API connection, encoder, stream-health monitor or failover programme.
- The existing health check is not surfaced as a full production control room, and there is no dedicated TOTP end-to-end/database release gate.
- Public music playback exists, but external broadcast rights and Content ID clearance are not represented in the episode contract.

## Recommended route

Build **deterministic MP4 export first**, then release episodes as scheduled YouTube Premieres. Only move to RTMPS live transmission after several successful automated exports. This preserves the feeling of a live show while avoiding the operational risk of making the first external release a true live encode.

```text
Game state → frozen episode manifest → deterministic render → QC → YouTube Premiere
                                                     ↓
                                             archive + clips

Later:
approved master → redundant playout/encoder → YouTube test → live → archive
```

## Phase 0 — Define the broadcast contract

- Replace the temporary untyped RPC bridge with generated database types and resolve the duplicate TOTP migration timestamp before adding more production dependencies.
- Add database tests for episode preparation, running-order locking, broadcast transitions, settlement idempotency and replay visibility.
- Surface the existing release-health check in the admin area and send proactive alerts when charts are stale, a scheduled job stops or an episode is missing.
- Create one immutable episode manifest containing every act, duration, audio source, presenter line, camera cue, graphic, outfit snapshot, rights status and checksum.
- Separate four states: gameplay episode, production-ready, rendered master and externally published.
- Record music ownership/licence, territories, expiry, Content ID allowlisting and explicit YouTube-live permission per track.
- Define programme specifications: initially 1920×1080, 30 fps, H.264, AAC, fixed 16:9 safe areas and stereo delivery.
- Replace device speech synthesis in approved masters with uploaded or generated, versioned presenter audio.

**Gate:** lifecycle database tests and route-level player/admin tests pass; the same manifest generated twice is byte-identical; every item has valid media, duration, rights and checksum; no uncleared track can enter production.

## Phase 1 — Presentation polish inside the game

- Establish one broadcast graphics package for opening titles, logo bug, lower thirds, chart rundown, transitions, credits and special episodes.
- Replace the current app-panel look during programme playback with a clean, full-frame television output; player controls remain outside that frame.
- Add a show-local recovery screen so a 3D rendering fault falls back to audio, graphics and programme text instead of taking down the full page.
- Improve direction from fixed repeating cuts to musical-section cues, shot variety rules, continuity limits and collision/occlusion checks.
- Add visible presenter staging, branded studio surfaces, better lighting contrast, audience wardrobe/pose variety and more deliberate stage identities.
- Add a proper audio mix: song, presenter, applause, crowd bed, stings and transitions with ducking and peak protection.
- Add opening and closing credits, accessibility-safe typography and broadcast title/action safe areas.
- Improve countdown and status announcements for assistive technology, label every invitation time as London time, and replace text-only loading messages with stable programme-shaped placeholders.

**Gate:** creative review at representative frames from every segment; no clipped text, camera intersections, obstructed performers, repeated-shot fatigue, silence gaps or abrupt cuts; mobile playback remains usable without changing the broadcast frame.

## Phase 2 — Deterministic offline render and MP4 export

- Build a server-side/headless renderer driven only by the frozen manifest, not browser wall-clock time.
- Render every frame from an authoritative timeline and mix audio into the same master clock.
- Add a render queue with progress, retries, cancellation, idempotency and immutable output metadata.
- Produce a mezzanine/master MP4, YouTube delivery MP4, poster image, thumbnail candidates, chapter markers and WebVTT captions.
- Store frame count, duration, codecs, resolution, bitrate, audio sample rate and hashes against the episode.

**Gate:** two renders have identical timeline/hash outcomes; audio/video drift is under one frame at programme end; automated probing confirms format and duration; black-frame, frozen-frame, missing-audio, clipping and caption-overflow checks pass.

## Phase 3 — Production control room and rehearsal

- Surface chart freshness, running-order lock, asset readiness, rights, presenter audio, render status and delivery status in one admin view.
- Add preflight severity: blocking, warning and informational.
- Add a rehearsal render using the exact production manifest, plus segment preview and replacement controls before final lock.
- Add audit history for overrides, re-renders, approvals and publish actions.
- Create a dedicated TOTP release suite: database lifecycle harness, browser journey, visual snapshots, audio lifecycle, render smoke test and failure recovery.

**Gate:** a full shadow episode runs from chart snapshot to approved MP4 without manual database intervention; forced failures recover without duplicate rewards, archives or uploads; blocking preflight failures cannot be overridden silently.

## Phase 4 — YouTube upload and Premiere

- Connect a dedicated YouTube channel through server-side OAuth; keep refresh credentials and stream credentials out of the browser.
- Create the video from episode metadata, upload the approved MP4 resumably, set title/description/tags/thumbnail/chapters/captions and schedule it as private or unlisted first.
- Run automated post-upload checks before scheduling a public Premiere.
- Synchronise the in-game “Watch live” destination with the YouTube watch URL while retaining the in-game archive.
- Record YouTube IDs, processing status, publication time and failures on the production record.

**Gate:** three consecutive unlisted episodes upload, process and play correctly on desktop, mobile and television; captions, thumbnail and metadata appear; retries never create duplicate videos; publication can be cancelled safely.

## Phase 5 — Rights, safety and accessibility hardening

- Require signed player consent for external use of band names, avatars, lyrics, recordings and generated likenesses.
- Add moderation for names, lyrics, imagery, presenter scripts and user-generated audio before rendering.
- Establish takedown, correction, replacement and archive-retention procedures.
- Generate captions from the authoritative script/lyrics, then validate timing and readability.
- Add flashing-pattern, high-contrast, loudness and true-peak checks; create a clean fallback for missing or rejected assets.

**Gate:** rights and moderation reports are attached to every master; a simulated takedown can remove or replace an act without corrupting game settlement; accessibility checks pass before upload.

## Phase 6 — True YouTube Live transmission

- Use a controlled playout service to send the approved master to YouTube over RTMPS; never expose the stream key to the app.
- Through the YouTube Live API: create the broadcast, create/reuse the stream, bind them, start a private test, confirm the stream is active, then transition to live and complete.
- Add a slate, countdown, standby loop and a complete backup programme so the feed never drops to black.
- Monitor encoder health, dropped frames, bitrate, audio level, YouTube stream status and end-to-end delay.
- Keep automated public transition disabled until private/unlisted soak tests are consistently successful.

**Gate:** at least five private/unlisted rehearsals run end-to-end; one rehearsal deliberately loses its primary encoder and switches to backup without ending the event; the operator can abort, hold on standby and complete safely.

## Phase 7 — Operations and audience growth

- Add a fortnightly production calendar with deadlines for selection, consent, assets, rights, rehearsal, approval, upload and transmission.
- Add alerts for stale charts, missing acts, render delays, failed YouTube processing, stream degradation and unclosed broadcasts.
- Create post-show clips and Shorts only from rights-cleared moments, with links back to the full programme and game.
- Track concurrent viewers, average watch time, retention by segment, replay views, clip conversion and in-game participation.
- Run quarterly disaster-recovery rehearsals and keep credentials, runbooks and responsibilities current.

**Gate:** two production cycles complete without emergency database work; alerts arrive before viewer impact; post-show reports reconcile YouTube and game episode IDs.

## Quality scorecard for every episode

- **Editorial:** chart snapshot fresh, eligibility reproducible, no consecutive act breach, #1 closes where applicable.
- **Visual:** no blank frames, clipping, unsafe text, camera collisions, missing models or unreadable graphics.
- **Audio:** all sources present, speech intelligible, music/presenter/crowd balanced, no clipping, silence or end drift.
- **Technical:** exact duration, expected frame count, H.264/AAC delivery, stable frame cadence, valid checksum and captions.
- **Rights and safety:** every asset cleared, consent current, moderation passed, Content ID handling confirmed.
- **Reliability:** retry-safe render/upload, no duplicate settlement, backup master available, operator abort tested.
- **Audience:** watch page ready, metadata/thumbnail approved, captions published, archive and links verified.

## Initial delivery target

Aim first for a polished **12–20 minute prerecorded episode** published as an unlisted YouTube Premiere. Use 3–5 acts, one chart segment and fixed recorded presenter links. Do not attempt a public live broadcast until Phases 0–5 have passed repeatedly.

## Technical notes

- YouTube models a broadcast event separately from its ingest stream; they must be created and bound before transmission.
- YouTube requires an active stream before transitioning a broadcast to testing or live.
- YouTube recommends representative pre-show testing and live stream-health monitoring; 1080p30 H.264 is a practical initial target.
- YouTube scans live streams for third-party copyrighted material, and even licensed content can be interrupted without Content ID allowlisting. Rights clearance is therefore a release blocker, not a later enhancement.
- The render/encode worker must run outside the browser and outside short-lived request handling; the existing client app remains the control and viewing surface.
