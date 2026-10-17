# DJ audio Phase 0 — production migration and security receipt
Date: 2026-10-17 · Environment: RockMundo Supabase, eu-west-2.

## Why this cutover was needed
The merged DJ audio migration file 20261017214000 was malformed (duplicated
SQL and a broken storage-path constraint) and absent from live migration
history. Players could not use the new DJ catalogue because its table, song
opt-in column and private audio bucket were missing.

Existing practice-track policies granted any authenticated user insert/update/
delete permissions on the admin practice audio catalogue and Storage bucket.
An existing band-song UPDATE policy also allowed collaborators to reassign
song owners and bypass DJ-sharing consent.

## Applied migrations and source files
| Version | Applied name | Repository SQL |
|---|---|---|
| 20261017204839 | dj_audio_library_phase0_secure_cutover_20261017 | supabase/migrations/20261017204839_dj_audio_library_phase0_secure_cutover_20261017.sql |
| 20261017205420 | guard_direct_song_ownership_transfer_dj_phase0_20261017 | supabase/migrations/20261017205420_guard_direct_song_ownership_transfer_dj_phase0_20261017.sql |

Both were applied through the connected Supabase migration API. The repository
now uses filenames aligned with live migration ledger versions. The previous
malformed migration file was replaced; do not reintroduce or re-apply it.

## Verified against the production database
- DJ catalogue exists; four table RLS policies and a private 50 MiB audio bucket.
- DJ bucket has four scoped Storage-object policies; non-admin writes denied.
- Song DJ-use flag defaults to false; consent guard checks original user owner
  or admin role for changes.
- The original authenticated-any-write practice-track policies are absent;
  admin-only writes exist, public reads preserved.
- Direct song ownership transfers require trusted server sale workflow or
  admin role. The existing complete_song_sale function is owned by postgres,
  runs SECURITY DEFINER and is not blocked.
- Supabase test harness at supabase/tests/dj_audio_phase0_rls_harness.sql passed
  against the live database. It exercised normal-user and admin RLS using
  rollback-only fixtures, including owner consent and collaborator abuse tests.
- An unauthorized band-collaborator ownership reassignment was reproduced in
  a rolled-back test before the second migration, then blocked after it.
- No test media or player data changes persisted. No DJ admin audio has yet
  been uploaded.

## Remaining browser and operational release tests
1. As admin, load /admin/dj-audio-library, upload a small rights-cleared track
   with accurate credit and licence source. Confirm the private file and row.
2. As a non-admin, verify admin route denied, published catalogue readable
   and unpublished tracks invisible and unable to generate new signed URLs.
3. Play two real audio tracks at /nightclub/:clubId (own recorded song plus
   admin track) on desktop and mobile; cue, seek, crossfade, stop on close.
4. Check legacy admin practice-track upload/replace/delete still work;
   non-admin practice audio remains readable but not replaceable.
5. Test licence withdrawal. Existing already-issued signed URLs expire later;
   urgent removal requires the Storage API, not direct SQL deletion.
6. Run regressions for SongPlayer, AI generation, recording, radio, stage
   practice, normal band gigs and existing DJ history. New paid DJ performance
   settlement remains disabled until #4234 and #4246 land.

## Safe rollback
Prefer disabling the affected client feature rather than deleting the new
catalogue, song consent or media. Reverting to publicly writable practice
audio is **never** an acceptable rollback. If the data model must be removed,
archive catalogue and rights evidence, coordinate active application versions,
and reconcile the migration ledger in a separate controlled operation.

## Linked work
#4260 Phase 0 manual/browser certification; #4256 legacy audio security;
#4234 server-authoritative DJ settlement; #4246 DJ bookings; #4258 epic.
