# Phase 5 PR 12 — Admin Gig Viewer Demo and Optional Setlist Audio

## Current audio audit

Repository evidence shows `songs.audio_url` is the established playable generated-song field used by `SongPlayer`, public song pages, release tracklists, charts, radio, song manager, Eurovision, and legacy gig review surfaces. Migrations add `songs.audio_generation_status`, `audio_generated_at`, `audio_generation_started_at`, `audio_prompt`, `duration_seconds`, and later `extended_audio_url` / `extended_audio_generated_at`. The `music` storage bucket is public. Existing players use `HTMLAudioElement`, explicit play/pause buttons, volume/mute controls, load/error cleanup through element listeners, and do not require audio for page function.

## Selected audio source

The gig viewer uses a narrow descriptor on each `GigExperienceSongDTO`. Source order is:

1. approved full generated audio from `songs.extended_audio_url` when status is absent or approved/completed/ready;
2. approved preview/generated audio from `songs.audio_url` under the same status rule;
3. no audio.

Processing, generating, pending, failed, deleted, rejected, blocked, private, missing, or denied sources resolve as unavailable.

## Audio permission model

The viewer does not issue audio generation, upload, update, replace, or delete calls. It relies on the same Supabase read/RLS path used to load the gig experience and setlist song joins. Fixture admin audio is labelled `admin_demo`. URLs are consumed only as presentation descriptors; service credentials, prompts, provider details, and moderation internals are not exposed.

## Excerpt model

The viewer maps compressed song segments to deterministic excerpts. `deterministicExcerptStart(songId, replaySeed, durationSeconds, excerptDurationSeconds)` hashes stable inputs and clamps within track bounds. Segment length determines excerpt duration. Short tracks start at zero. No `Math.random` is used, and replay events are not changed.

## Speed behaviour

At `1×`, enabled audio plays the normal deterministic excerpt. At `2×` and `Fast`, song audio is muted/stopped and the UI states that audio is available at normal speed. Returning to `1×` re-resolves the current song and seeks to the corresponding excerpt position, avoiding accidental pitch shifting.

## Seek behaviour and cleanup

The dedicated controller owns one `HTMLAudioElement`. Song changes, seeking, restart, result reveal, non-song phases, close/unmount, and hidden-tab changes stop or pause stale audio before resolving the current song. Visual replay remains authoritative and silent when audio is missing or blocked.

## Admin demo architecture

`/admin/gig-viewer-demo` is protected by `AdminRoute` and linked in the Bands & Performance admin category. It has fixture mode and a read-only real replay inspector. Fixture mode builds local deterministic `GigExperienceDTO` data and replay payloads, labels all output as demo data, and does not call gig start, processing, completion, reward, replay mutation, audio generation, or song update APIs.

## Fixture presets

Presets are code fixtures: Empty club, Half-full small venue, Sold-out club, Average theatre show, Poor arena booking, Sold-out arena, Solo acoustic-style act, Standard four-piece band, Large ensemble, Rising momentum, Major recovery, No encore, Excellent encore, Mixed audio availability, and No song audio.

## Real replay inspector

The inspector performs a narrow read of ready `gig_viewer_replays` metadata and hides payload/audio secrets. It displays version, schema, duration, status, generated time, and read-only validation text.

## Diagnostics

The demo includes audio diagnostics per setlist song: title, playable/unplayable status, source type, duration, reason unavailable, and signed/private URL status without printing sensitive URLs. Viewer controls show current audio source, status, speed muting, and playback errors.

## Files changed

See the PR diff for the new audio controller/resolver/preferences, viewer audio controls, admin demo page, route/nav additions, DTO audio descriptor, tests, and docs.

## Tests

Added unit coverage for audio source selection and excerpt bounds. Existing release-gate commands remain the validation path; this container lacked installed dependencies for Vitest.

## Known limitations

The real replay inspector is intentionally metadata-first and does not expose raw payloads or signed URLs. Real browser autoplay and media-device profiling still require browser infrastructure. The fixture demo uses an existing demo/public audio path for admin-only fixture playback rather than generating assets.

## Recommended next area

Run the Phase 5 release gate in provisioned CI with dependencies installed, then add true Playwright/axe/browser media smoke coverage for audio activation, mobile layout, and hidden-tab lifecycle.
