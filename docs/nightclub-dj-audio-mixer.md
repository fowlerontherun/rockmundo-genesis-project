# DJ audio catalogue and playable two-deck mixing studio (phase 1)

This is a standalone **practice-only** live audio mixer. It does not award any
XP, fans, fame, money or gig achievements, and does not claim to record a mix.
Real booked nightclub performances, saved setlists, beat-grading, 3D DJ avatars,
crowd dance responses and server-side payouts are tracked in issues #4246-#4248.

## Player workflow
1. Enter a city nightclub at `/nightclub/:clubId`.
2. Open **DJ Mixing Studio**; it loads eligible game audio and cleared admin club music.
3. Choose separate tracks on Deck A and Deck B.
4. Press Play on either/both decks. Seek to a phrase, set a cue point and jump back.
5. Change playback speed within 85–115%, optionally matching BPM metadata from
   Deck B to Deck A. For untagged game audio, beatmatch by ear.
6. Drag the crossfader; both audio elements play simultaneously with bounded
   equal-power gain. Closing the studio stops the audio.
7. Owners can opt their own playable songs into other players' DJ catalogues.
   Opted-in recorded or released songs become discoverable to other DJs.

**Audio note:** This MVP uses browser audio playback-rate changes; these change
pitch as well as tempo and are *not* key-locked timestretch. The future minigame
will supply phase/beat-grid scoring and advanced controls. Music must be
rights-cleared and accessible to the client's browser. No external audio is
downloaded into server-side DJ recordings.

## Admin workflow
1. Apply `supabase/migrations/20261017214000_dj_audio_library.sql`
   through the reconciled migration rollout pipeline (verify deployed schema
   first; do not assume source migration history mirrors production).
2. Open `/admin/dj-audio-library`, under Admin → Music & Content.
3. Upload MP3, M4A, OGG, WAV or WebM (maximum 50 MiB). Provide title, artist,
   genre, optional BPM/key, and a **rights source note**. Confirm usage rights.
4. Published tracks appear in player selectors. Unpublish to hide from the
   catalogue and prevent new signed-storage URL creation by ordinary players.

The audio bucket is private; only admins can upload/delete and only published,
rights-cleared tracks are signable by authenticated players through Storage RLS.
Already-issued signed URLs remain usable until expiry. When handling takedowns,
delete/revoke the object too if immediate cessation is required.

## Game-song eligibility
- The active character's own playable recorded/completed/mastered/released songs
  can always be mixed in their own practice studio.
- Other artists' songs must be recorded or released and explicitly opted into DJ usage with
  `songs.dj_use_allowed = true`.
- An archived song, missing audio, or a URL with an unsafe scheme is never queued.
- When both short and extended audio URLs exist, the extended audio is preferred.
- BPM and musical key are optional for game tracks; manual tempo correction works
  without them. Metadata/automatic beat detection can come in a later phase.

## Tests / verification
- `src/features/nightclub-dj/mixerMath.test.ts` covers crossfade positions, headroom,
  bounded speed, unavailable tempo metadata and elapsed-time format.
- `src/features/nightclub-dj/library.test.ts` covers owner access, released opt-in,
  archived/unplayable exclusion and private admin storage URL handling.
- After applying the migration, test with a real **non-admin** identity:
  rejects bucket uploads and new/updated/deleted catalogue rows; does not list
  unpublished tracks or sign unpublished objects.
- Admin can upload and unpublish. Player sees approved tracks, selects A and B,
  and mixing audio stops on close. Verify desktop and mobile (including reload,
  muted system audio, missing asset, suspended tab and mixed file formats).
- Check that shared recorded/released songs are only visible when opted-in, and
  that no new cash/fame/XP operations occur from this studio.

## Deferred
- Authorization of audio files hosted externally remains their source's
  responsibility. Prefer ingesting future generated audio into first-party
  storage when stable permissions and CORS are needed.
- Audio mixing is local only and not saved, streamed to spectators or uploaded.
  Adding offline rendered export requires a separate rights/permission and
  transcoding review.
- BPM detection, waveform visualisation, hot cues, key lock, EQ filters,
  sync/beat-grid phase scoring and a DJ-recording workflow are later iterations.
