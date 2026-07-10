# Phase 4 PR 02 — Contribution Source Accuracy and Participant Adapters

## Recommendation source

Phase 4 PR 01 recommended adding a stricter contribution-source adapter layer and expanding participant-level sources only where repository data proves both participation and band relationship.

## Source-system audit

- **Rehearsals:** `band_rehearsals` is band-scoped and has completion/cancellation state, but no attendee, invitation, RSVP, or attendance-status table was found. It remains partially authoritative at the band completion level only.
- **Gigs:** `gigs` and `gig_outcomes` are band-scoped completion records. `gig_song_performances` is song-level, not performer-level. No band-member lineup or performer attendance table was found. It remains partially authoritative at the band outcome level only.
- **Recording:** `recording_sessions` is band-scoped when `band_id` is set and has completed state. `production_tracks` records uploaded tracks by profile user for the session, which is an explicit participant signal. The session owner/profile remains authoritative for the session they created.
- **Jam sessions:** `jam_session_outcomes` and participant tables are participant-level, but `jam_sessions` has no single authoritative `band_id`; host/creator alone does not prove one-band ownership. It remains unsupported for band contribution.
- **Songwriting:** `songwriting_projects` and `songwriting_sessions` are owner/session based. The audited schema does not provide accepted band co-author records tied to a stable band-owned completed song lifecycle. It remains unsupported for band contribution.

## Authoritative sources found

- Completed band `recording_sessions` with `band_id`.
- Recording session owner/profile.
- `production_tracks` rows for the same recording session, joined through `profiles.user_id`, as explicit uploaded-track participants.

## Unsupported sources

- Rehearsal attendee-level credit: no attendance source table found.
- Gig performer-level credit: no lineup/performer source table found.
- Jam contribution: participant outcomes exist, but sessions are not reliably band-scoped.
- Songwriting credit: no accepted, band-owned completed co-author path was found.

## Adapter design

This PR adds a small database adapter function rather than a generic event bus:

- `capture_contributions_for_recording_session(recording_session_id)` resolves the completed band recording source.
- The adapter resolves the authoritative band from `recording_sessions.band_id`.
- It resolves participants from session owner/profile plus uploaded `production_tracks` participants.
- It delegates immutable insert/idempotency to `insert_band_contribution_event`.
- It returns the number of newly inserted events and ignores unsupported/malformed sources safely.

## Participant-resolution rules

Recording contribution now credits:

1. the completed band recording session owner/profile, if valid;
2. each distinct profile with a `production_tracks` upload for that session;
3. only profiles that pass band membership validation at the event time.

NPC producers, orchestra bookings, declined invites, and implied collaborators are not credited because they are not explicit player contribution records for this band log.

## Membership-at-time handling

`is_band_member_at_time` validates the member is active and that `joined_at` is not after the contribution `occurred_at`. The current schema does not provide a reliable historical leave timestamp for `band_members`, so inactive/former members are not eligible for newly captured events, while previously inserted historical events remain immutable.

## Contribution types added

No new contribution types were added. The verified implementation reuses `recording_participation` because only recording has explicit participant rows that can be safely connected to a completed band source.

## Server-authoritative integration points

The existing completed-recording trigger now calls the recording adapter. Rehearsal and gig triggers remain conservative until authoritative attendance/lineup tables exist.

## Idempotency model

The existing unique constraint on `(band_id, profile_id, contribution_type, source_entity_type, source_entity_id)` remains the duplicate-safety boundary. Retrying the adapter or processing the same completion twice does not create duplicate events.

## Privacy model

The read model remains unchanged: current active band members can read contribution events for their band; former members, unrelated users, unauthenticated users, and direct client mutations remain denied. Metadata added by the adapter is limited to safe labels and verification category, not private schedules, messages, health, energy, skills, auth IDs, payments, or audit internals.

## UI changes

The Contributions tab now explains that summaries are based on recorded participation where supported and shows a neutral “Verified participation” indicator when metadata confirms participant-level source resolution.

## Database changes

- Added `is_band_member_at_time` helper with safe `search_path`.
- Updated `insert_band_contribution_event` to use membership-at-time validation where available.
- Added `capture_contributions_for_recording_session` as the first contribution-source adapter.
- Added a narrow source lookup index for adapter/idempotency workflows.
- Replaced the completed-recording trigger function body to call the adapter.

## Tests

- Unit coverage for verified participant metadata detection.
- Component coverage for the verified participation label.
- Database harness documentation updated for adapter cases.

## Backfill decision

No automatic backfill is included. Recording participants can be derived for historical sessions, but a separate reviewed migration should batch that narrowly after local fixture drift is resolved.

## Known limitations

- Rehearsals and gigs still use active members at completion because member-level attendance/lineup records were not found.
- Jam outcomes remain excluded because the session is not authoritatively band-owned.
- Songwriting remains excluded because accepted band co-author completion is not clearly represented.
- Membership-at-time checks can prove `joined_at <= occurred_at`, but cannot prove historical leave time without future membership history data.

## Recommended Phase 4 PR 03

Add explicit participant tables for rehearsal attendance and gig lineups, or wire existing gameplay to such authoritative rows, then move rehearsal/gig contribution triggers from broad active-membership capture to verified participant adapters.
