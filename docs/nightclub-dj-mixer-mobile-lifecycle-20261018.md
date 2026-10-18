# DJ mixer background/resume and audio-retry hardening (18 October 2026)

Follow-up to #4262 (partial; not a completed audio release gate).

## Changes

- Stop both decks when the browser tab is backgrounded or the page is hidden
  on mobile. Stop on `pagehide` navigation and when each audio deck unmounts.
  Returning to the tab **does not auto-play**: players explicitly press Play.
- A track changing beneath the same ID (e.g. catalogue refresh, owner
  revocation, published-audio path replacement) now causes the deck to stop
  and reload the new source, rather than continuing with a stale URL.
  When a song disappears, the deck is cleared; the selector can load another
  available song. Previously selected cue/position are reset on reload.
- Network/media load errors expose a **Retry audio** button that obtains
  a new authenticated signed URL where needed and never silently restarts
  audio. If rights have been removed, the signing service rejects the request.
- Existing live `onPlay`, tempo and crossfader telemetry is unchanged;
  no reward writes were added to practice mode.

## Tests

- `deckAudioLifecycle.test.ts`: background, hidden-at-mount,
  pagehide/unmount and no auto-resume.
- `deckPlayback.test.ts`: signed URL refresh and errors/revocation.
- The standalone audio lifecycle helper was also checked with strict
  TypeScript DOM typing and three event-target checks in a local Node
  environment. End-to-end playback still needs a real-device browser test.

## Outstanding #4262 work

Two-deck low-latency shared audio clock, optional Web Audio buses and
fallback, crossfade peak/limiting certification, waveform/beat guidance,
full portrait accessibility, expiry during *ongoing* streams, and
authenticated mobile/desktop browser QA remain pending. Retain the
server/client scheduled-DJ release gates **OFF** pending comprehensive
certification. No database changes or paid DJ feature activation in this PR.
