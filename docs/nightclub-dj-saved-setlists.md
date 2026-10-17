# DJ set preparation — Phase 3 foundation

## Release state
- **Code:** PR #4268, save/reopen/reorder/delete, rehearsal loading from DJ Mixing Studio.
- **Live schema:** Supabase migration `20261017215911_dj_draft_setlists_with_rights_validation_20261017` applied to the RockMundo project.
- **Economy:** all saved sets are draft/practice-only. **No bookings, XP, fame or cash are attached.**
- **Rights:** new and modified setlists validate track permissions on the server every time. A future booked show **must revalidate and snapshot** rights and song versions at booking/check-in/start.

## Player workflow
1. Open Nightclub → DJ Mixing Studio.
2. Expand **Prepare a DJ set**, select **New DJ set** and name it.
3. Choose a track from your own playable recordings, tracks shared by another creator, or the published/cleared admin club catalogue.
4. Click **Add** repeatedly, move tracks up/down, or remove tracks.
5. Save; the active character retains an ordered draft. Previously saved sets may be selected and edited; edits use a revision check to avoid overwriting another browser session.
6. Load the first two songs to Deck A/B, or load a specific saved track into either deck while practicing transitions. Playback is still controlled through the existing mixer.
7. If a creator unshares a song or an admin unpublishes audio, it displays as unavailable and cannot be newly saved or reloaded into a deck via this planner. Replace or remove it. Existing saved descriptors are not public playable links.

## Data model
One table `public.dj_setlists`, each row containing:
- `id`, `user_id`, `profile_id`, `name`, `version`, timestamps.
- `items`: JSONB array of 1–30 objects exactly `{ "source": "game" | "admin", "id": "<uuid>" }`.
- `source=game`: references `songs.id` and requires playable recorded/completed/mastered/released audio. Own songs must belong to the same authenticated user and active profile; other recorded/released songs need `dj_use_allowed=true`.
- `source=admin`: references `dj_audio_tracks.id` and requires published, rights-confirmed audio.
- The server writes `updated_at`, increments `version`, and prohibits changing user/profile ownership once created.
- RLS allows the authenticated owner of the active character to read/create/update/delete their drafts. No anonymous listing or global DJ set search.
- Signed URLs are never persisted in the set.

## Limitations and next steps
- Track order is **not yet** a locked gig contract. A booked performance will need a permanent snapshot, song start/end/cue/phrase data, permitted cover/royalty treatment, slot duration checks and immutable event timeline (#4246).
- The estimated total length counts known full-track durations. An unknown duration may understate playtime; crossfades will also reduce elapsed show time.
- No automated sequential playback, recording of mixes, or download/export of copyright music.
- Playlist browser uses up to 50 saved sets per profile. The underlying song library currently has finite client query limits; server search/pagination will follow in Phase 1 (#4261).

## Verification
- `src/features/nightclub-dj/setlists.test.ts`: source keys, draft capacity, readiness and reordering.
- `supabase/tests/dj_draft_setlists_rls_harness.sql`: rollback-only live tests for ordinary user save/edit, revision increment, forbidden cross-account access, unpublished admin media, invalid sources and empty lists.
- Successfully executed against production with no persisted fixtures; at migration time the table contained zero sets.
- **Pending:** real browser save/reopen, selected character swap, multiple-device stale write, mobile controls, signed URL playback and CI.
- Rollback preference: hide planner/UI if needed, keep draft data; never weaken content RLS or delete a player's saved sets just to disable the feature.
