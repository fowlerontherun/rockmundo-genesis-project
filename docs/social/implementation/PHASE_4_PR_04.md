# Phase 4 PR 04 — Rehearsal Participant and Gig Lineup Read-Only UI

## Recommendation source

Phase 4 PR 03 recommended adding narrow read-only UI joins for rehearsal participant and gig lineup status before considering any leader-managed attendance or lineup adjustment RPCs.

## UI surfaces selected

- Existing Rehearsals page cards now show a compact read-only **Rehearsal attendance** section for each upcoming or completed rehearsal.
- Existing Perform Gig detail page now shows a compact read-only **Lineup** section for the selected gig.
- Existing schedule records and routes are preserved. The schedule remains linked to rehearsal and gig detail surfaces instead of fetching participant lists for every schedule item.
- Existing Contributions tab keeps contribution events compact and now uses clearer source-action labels for rehearsal and gig participation.

## Rehearsal participant display

The rehearsal section shows public profile identity, avatar where available, and repository-backed participation status only. Supported values map to:

- `invited` → **Expected**
- `attended` → **Attended**
- `missed` → **Missed**

Upcoming rehearsals explain that band members are currently included automatically. Completed rehearsals show final recorded status without guessing. Older completed rehearsals with no participant rows show that participant details are unavailable for the older event.

## Gig lineup display

The gig section shows public profile identity, avatar where available, copied role/instrument from `gig_performers.role_or_instrument`, and repository-backed lineup status only. Supported values map to:

- `selected` → **Selected**
- `performed` → **Performed**
- `missed` → **Missed**

Upcoming gigs explain that the lineup is generated from active performing members. Completed or cancelled gig rows remain read-only history; the UI does not infer performance from band membership.

## Status mappings

`src/lib/participationStatus.ts` centralizes rehearsal and gig status display metadata: label, semantic category, badge variant, final-state marker, and a safe unsupported-value fallback.

## Query design

`src/hooks/useParticipationDetails.ts` adds narrow React Query hooks for:

- `band_rehearsal_participants` by `rehearsal_id`
- `gig_performers` by `gig_id`

Both use stable query keys, narrow selects, joined public profile identity, deterministic ordering, and no direct mutations. The hooks do not query private profile fields.

## Permissions/privacy behaviour

No new public access path or mutation policy is added. The UI relies on the existing PR 03 RLS policies, where authenticated current active band members can read rehearsal participants and gig performers, while former members, unrelated users, and unauthenticated users receive no private operational rows. Public gig surfaces are not broadened.

## Schedule integration

No duplicate schedule records were created. Participant and lineup detail is fetched only on existing detail/card surfaces, not for every schedule item.

## Contribution integration

The Contributions tab keeps existing event rows and neutral summaries. It now labels verified rehearsal and gig actions as **Attended rehearsal** and **Performed at gig**. It does not embed full participant lists, rankings, rewards, XP, chemistry, percentages, or consequences.

## Files changed

- `src/lib/participationStatus.ts`
- `src/hooks/useParticipationDetails.ts`
- `src/components/social/ParticipantStatusList.tsx`
- `src/pages/Rehearsals.tsx`
- `src/pages/PerformGig.tsx`
- `src/lib/bandContributions.ts`
- Tests for status mapping, UI states, and contribution labels
- Social planning/audit documentation

## Database changes

No migration was needed. Existing PR 03 tables, indexes, and active-band-member RLS policies were sufficient for read-only UI.

## Tests

Added unit/component coverage for status mappings, rehearsal participant display states, gig lineup display states, no edit controls, accessible status labels, older-event unavailable states, loading/error states, and contribution source-label clarity.

## Known limitations

- Rehearsal rows do not currently expose band role/instrument because `band_rehearsal_participants` stores only participant identity and status.
- No RSVP, attendance editing, lineup editing, substitutes, session musicians, penalties, rewards, XP, chemistry, achievements, goals, or leaderboards are added.
- Older rehearsals/gigs without participant or performer rows remain unavailable rather than inferred.

## Recommended Phase 4 PR 05

Design explicit product rules for leader-only attendance/lineup adjustment, absence handling, and privacy review before adding any mutation RPCs. Keep rewards/progression out until attendance dispute and lineup-management rules are settled.
