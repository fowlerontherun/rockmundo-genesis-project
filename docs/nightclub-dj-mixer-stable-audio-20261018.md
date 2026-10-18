# DJ mixer playback identity and live auto-sync repair

**Scope:** #4262, DJ mixing frontend; no changes to database, payouts or release flags.

## Issues fixed

1. The source-loading effect was dependent on the entire `DjAudioTrack`
   object. Refetching metadata (title, BPM, sharing display state) reconstructs
   objects even when their playable URL and ID remain unchanged, causing
   both decks to stop and start loading again, dropping cue/position and
   disrupting a live set. The effect now depends on a stable fingerprint of
   the playable track identity and media source only.
2. The **Match Deck B tempo to A** shortcut changed the audible deck speed
   but did not submit a server-verified tempo event. When running in a booked
   live set, this could leave the authoritative mixing checklist unfulfilled
   despite a genuine sync action. Now an actual percentage change produces
   a `tempo`, deck `B` event with a bounded 85–115 value through the
   existing signed-in, idempotent event transport. Unchanged auto-sync does
   not create a fake interaction; ordinary practice still writes no event.

## Behavioural guarantees

- Metadata-only refresh: no media reload or playback interruption.
- Track identity, audio URL or admin storage path changes, or a withdrawn
  track: stop previous audio and reload or clear the player.
- Explicit `Retry audio` continues to obtain a new signed link.
- Playback remains stopped in the background as in PR #4332.
- Server controls validation, event count, timestamp, pacing and rewards.
  UI changes never claim verified evidence before server acknowledgement.

## Verification

- `mixerMath.test.ts`: equal audio fingerprints for metadata-only updates,
  changed fingerprints for new source/withdrawal, 85–115 normalized tempo,
  and skip unchanged auto-sync.
- `node --test scripts/dj/mixer-stability.contract.test.mjs`: ensure
  React wires the fingerprint effect and auto-sync through the verified
  event sender with practice gating.
- Three pure-helper tests passed under strict TypeScript and Node locally.
  Full frontend/browser CI remains required.

## Not done

Do not enable scheduled DJ gigs yet. #4262 remains open for browser/mobile
audio certification, shared audio timebase, limiter/peak handling, equal-power
audio quality and further deck controls. Previous PR #4332 merged with CI
failures outside these changed files, which should be resolved separately.
