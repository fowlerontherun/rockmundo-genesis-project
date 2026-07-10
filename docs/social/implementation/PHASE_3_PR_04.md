# Phase 3 PR 04 — Recruitment Notification Actionability and History Polish

## Recommendation source

This PR implements the Phase 3 PR 03 recommendation to polish recruitment notifications and history after the guarded application lifecycle was completed by `submit_band_application`, `respond_band_application`, and `withdraw_band_application`.

## Previous notification/history behaviour

Recruitment notifications used the shared `band_request` notification type for both applications and invitations. Application submission notifications routed managers to `/bands/:bandId?tab=applications`, but the public band profile does not consume an `applications` tab query string, so stale manager notifications could land on a valid page without an understandable recruitment context. Final application and invitation transitions wrote metadata such as `band_application_status`, `band_invitation_status`, or `actionable: false`, but the bell UI did not display that state. The manager application list already preserved final rows, but status labels and actionability checks were duplicated inline. Applicant history was limited to the latest application for the currently viewed band profile.

## Implemented behaviour

Recruitment notifications now normalize `band_request` metadata through a shared notification model. The bell shows the current recruitment status when metadata is present, keeps read/unread and timestamp display, and sanitizes legacy `?tab=applications` application routes to `/bands/:bandId` so the destination remains valid. Final-state notifications display a status label rather than implying a pending decision.

Manager application history now shows the newest 50 rows for the selected band with applicant public identity, requested role, submitted date, resolved date when present, status, private message preview, and approve/reject controls only for pending rows. Final rows are explicitly read-only.

Applicant history now appears on the existing band profile surface as a narrow “My Application History” card. It lists the viewer’s latest 25 applications across bands, shows band name, requested role, submitted/resolved dates, current status, and a band profile link. Only pending owned applications expose withdrawal.

## Notification state model

Supported repository-backed recruitment statuses are normalized through `src/lib/recruitmentStatus.ts`:

- `pending` — actionable, not final.
- `accepted` — final, not actionable.
- `rejected` — final, not actionable.
- `withdrawn` — final, not actionable.
- `cancelled` — final, not actionable.
- `declined` — final, not actionable.
- `expired` — final, not actionable if older data uses it.

Unsupported statuses receive a safe non-actionable fallback label.

## Route model

- Application notifications with `band_id` route to `/bands/:bandId`.
- Legacy `/bands/:bandId?tab=applications` notification paths are normalized to `/bands/:bandId`.
- Invitation notifications continue to route to `/band-manager`, where existing invitation handling lives.
- Notifications without usable recruitment metadata retain their original `action_path`.

## Shared status mapping

The notification model, applicant application summary, applicant history, and manager history all use `getRecruitmentStatusMeta` rather than hand-written status label/actionability logic.

## Applicant history

Applicants can see their own history through the existing `band_applications` select policy. The UI queries by `applicant_profile_id`, sorts newest first, limits to 25 rows, and only exposes withdrawal for pending rows.

## Manager history

Managers see band applications through the existing Band Manager members surface. The UI queries rows for the selected band, sorts newest first, limits to 50 rows, and only exposes approve/reject controls when the shared status mapping marks a row actionable.

## Files changed

- `src/lib/recruitmentStatus.ts`
- `src/lib/recruitmentStatus.test.ts`
- `src/lib/notificationModels.ts`
- `src/lib/notificationModels.test.ts`
- `src/components/notifications/NotificationBell.tsx`
- `src/components/band/BandApplicationsList.tsx`
- `src/pages/BandProfile.tsx`
- `docs/social/implementation/PHASE_3_PR_04.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes, if any

No database migration is required. Existing `band_applications.responded_at`, notification metadata, RLS policies, and guarded RPCs support the polish work.

## Permission model

No RLS policies were broadened. Applicants still rely on applicant-owned `band_applications` visibility for their own history. Managers still rely on existing band application visibility for bands they currently manage. Lifecycle mutations still use the guarded RPCs; the notification UI does not mutate recruitment state.

## Automated tests

Added unit coverage for the shared status mapping and notification normalization, including pending/final application notifications, invitation final status, route normalization, and safe unsupported-status fallback. Existing BandApplicationsList tests continue to cover guarded approve/reject calls and final-state read-only rows.

## Manual verification

Recommended manual checks remain: pending, accepted, rejected, and withdrawn applicant history; leader/founder manager history; ordinary/former/unrelated user access; stale pre-final notification; missing/deleted band destination; and mobile/desktop layouts.

## Known limitations

Notification state reconciliation is metadata-first in the bell. The authoritative database status is displayed in application history screens after navigation, but the bell does not perform a per-notification application lookup. No auditions, role vacancies, matching, recruitment cooldowns, rewards, reputation, or broader permissions were introduced.

## Recommended Phase 3 PR 05

Recommended next PR: **Recruitment RLS and Route Verification Harness**. Add database-level policy tests or Supabase integration fixtures that explicitly prove applicant, leader/founder, ordinary member, former member, and unrelated-user visibility for application history and stale notification routes.
