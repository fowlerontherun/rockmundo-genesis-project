# Account-based retention measurement (2026-11-28)

## Why this was added

Registrations and character counts are not evidence of play. On 2026-11-28,
the existing admin analytics page counted `profiles` as "Total Players", but
accounts can create multiple characters. `profiles.last_login_at` supplies only
the most recent login and cannot reconstruct a D1/D7/D30 cohort history.

Read-only live checks (last 30 rolling days at time of audit) found 44 new
non-anonymous, non-deleted auth accounts, 12 with songwriting projects, 1 with
a song, 13 with a scheduled activity and 10 with an active band membership.
These are independent counts of **ever** reaching a milestone after signup,
not sequential conversion steps or actions necessarily completed within 30 days.

## Definition of the new metrics

- `player_engagement_days` stores just `(account UUID, UTC date, first_seen_at)`.
  One server-authenticated call to `record_player_open()` per account per UTC
  day is sufficient, regardless of how often a player changes routes.
- DAU: unique registered (nondeleted, nonanonymous) accounts with a game visit
  on the current UTC date. WAU uses the current UTC date plus six prior days;
  MAU uses current plus 29 prior days. These are *game opens*, not evidence of
  an action completed.
- Established active (7d): unique accounts visiting within that same seven-day
  window whose signup date is more than seven days before the current UTC date.
- D1/D7/D30: of accounts **registered after collection began** and eligible
  by age, the fraction opening the game on the exact 1st/7th/30th UTC calendar
  day after registration. The denominator includes all eligible signups, even
  those who never returned. These are exact-day cohorts, not "on or after" rates.
- The 30-day activation panel includes accounts created in the last rolling 30
  days. Each count answers whether they *ever* made a character, started a
  project, created a song, scheduled an activity or joined an active band.

### Important limitations

- Tracking begins only after the migration and frontend code are deployed.
  Historical cohorts are intentionally omitted. D7 becomes meaningful after
  seven days of collection; D30 after thirty days. Early values are shown as
  **Not available yet**, not misleading zero-percent retention.
- The first partial UTC day of tracking may exclude signups that preceded the
  very first recorded game visit.
- A game open measures player presence, not engagement depth. Use the signup
  milestone panel and future verified gameplay events to understand depth.
- Calendar-day windows are UTC rather than each player's local timezone.
- Client best-effort tracking can be missed when offline or blocked. Counts may
  be lower than actual opens; server-side deduplication prevents duplicate days.
- This does not report VIP purchases. A paid subscription should be verified
  against billing records, not `profiles.is_vip` or unexpired trial status.

## Security and privacy

The table has RLS enabled and no direct access for anonymous or authenticated
roles. `record_player_open` never accepts identity or timestamps from the
browser; `auth.uid()` and the server UTC date are authoritative. Admin-only
`admin_get_player_retention_analytics()` checks `has_role(..., 'admin')` inside
the database and returns aggregate JSON only. Neither RPC returns an account
list, names, IPs, route paths, chat content or free-text feedback.

Account UUIDs and visit dates are still account-linked usage data and should be
described in the game's privacy notice and retained only as long as needed.
Deleting an auth account cascades to its daily activity rows.

## Deployment and verification

1. Review and apply the new forward-only `20300101010100_player_retention_tracking.sql`
   migration to the target Supabase project. Check *live schema objects*, not
   `supabase_migrations.schema_migrations` history alone (repository and live
   migration versions diverge).
2. Deploy the updated web app. Both desktop and mobile game routes trigger the
   shared tracker; public and admin pages are excluded. A missing migration
   must not block gameplay.
3. Sign in as a normal player and visit `/dashboard`, then `/songwriting`.
   Verify that the database has **one** account-day row, not two, and that an
   unauthenticated call to `record_player_open()` returns false/permission denied.
4. Sign in as an admin and open `/admin/analytics`. Confirm the account count,
   daily activity and signup milestones appear. A non-admin calling the
   aggregate RPC must receive `Admin access required`.
5. Confirm a day boundary adds a new record, then monitor D1, D7 and D30 as
   cohorts mature. Compare these with the first-song and activation fixes.

No email, notification, VIP offer or customer-facing campaign is sent by this
change.
