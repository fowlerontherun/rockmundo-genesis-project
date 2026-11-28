# RockMundo player-retention audit — 28 November 2026

## Scope and method

Read-only aggregate checks against the production Supabase database (`auth.users`,
`profiles`, gameplay, messaging, survey and VIP tables) and a source review of
the first-week dashboard, songwriting booking and survey flow. No player records
were exported or modified. Counts represent a point-in-time snapshot in UTC.

**Important limitation:** `profiles.last_login_at` is a *last-login* timestamp,
not complete session telemetry. These are rolling-window login counts, **not**
standard Day-1/Day-7 cohort retention. Multiple characters are collapsed by
account `user_id` for the login counts. Some background gameplay can continue
without a fresh login.

## Observed baseline

| Measure | Result |
| --- | ---: |
| Non-deleted, non-anonymous auth accounts | 331 |
| Live (non-deleted) character profiles | 359 |
| New accounts in prior 7 days | 17 |
| New accounts in prior 30 days | 45 |
| Accounts with character login in prior 24 hours | 8 |
| Accounts with character login in prior 7 days | 21 |
| Accounts with character login in prior 30 days | 50 |
| Accounts older than 7 days that logged in during prior 7 days | **4** |
| Accounts older than 30 days that logged in during prior 30 days | **5** |

Of the 28 accounts created 8–30 days before this snapshot, only one had a
recorded login at least 24 hours after signup. Six created songwriting
projects, none had a row in `songs`, five scheduled an activity, two had an
active band membership and one completed a survey. All 28 had a `player_skills`
row; the presence of that row is not evidence of having intentionally used
skills.

Of the 17 accounts created in the preceding week, seven had songwriting
projects, one had created a song, nine had scheduled an activity and eight had
active band membership. These figures show adoption of early actions, but
should not be mistaken for retention.

Over the prior 30 days: 14 distinct accounts started songwriting sessions;
three accounts created five songs; the global chat had one message and direct
messages had none; two users completed a player survey. Thirteen unique users
had completed a survey since tracking began.

### VIP data caveat

The subscription table held one `paid`/`active` subscription with a Stripe
subscription ID. This is **not proof of a successful charge**; verify the Stripe
invoice/payment state separately. The table also held 183 `trial`/`active`
rows, 97 of which were past `expires_at`. Entitlement logic must check dates,
not treat `status = 'active'` alone as proof of access. A later payment-flow
audit should determine whether expiry status needs reconciliation and whether
trial presentation is contributing to poor conversion.

## Confirmed code defects and first fix

1. `src/pages/booking/SongwritingBooking.tsx` filtered projects using
   `status = 'in_progress'`, but live projects use `draft` and `writing` (with
   an `arranging` state supported by the editor). It also attempted a direct
   `player_scheduled_activities` insert instead of the existing authoritative
   `schedule_songwriting_session` RPC. This bypassed schedule validation and
   used a character ID in the account `user_id` field.
2. `src/components/dashboard/DashboardHero.tsx` queried a nonexistent
   `songwriting_projects.progress` column, so its `currentProject` query failed
   silently. The resume action led to `/booking/songwriting`, not the song
   editor, and displayed raw progress points as if they were percentages. Its
   generic first recommendation was to book a gig, even when the player had
   neither a song nor an unfinished project.
3. `src/components/dashboard/GettingStartedPanel.tsx` directed players without
   projects to the booking page. It only awarded first-song checklist progress
   when a full song existed, although projects are intentionally multi-session.
4. `src/pages/Dashboard.tsx` automatically presented an optional 10-question
   survey as a modal on the dashboard. Players could postpone it, but it
   interrupted the first-session experience and recurred on subsequent visits.

The companion PR repairs these first-session and return-to-song paths, reuses
the authoritative scheduler, counts starting a songwriting project as an early
milestone, and makes the survey an explicit opt-in card without changing its
existing reward or questions.

## Next investigative priorities

1. **Instrument real sessions and onboarding milestones.** Record first
   dashboard, first song project, first scheduled session completed, first gig,
   first band collaboration and meaningful return sessions. Count account IDs,
   not character rows. Establish D1/D7/D30 retention by signup cohort.
2. **Audit the time from songwriting project to first finished song.** Separate
   a player who is waiting for a scheduled session from one blocked by a failed
   action. Add contextual guidance for multi-session projects and unclaimed
   results.
3. **Observe booking errors, class attendance and reward settlement.** The
   game has previously had reports about university auto-attendance and XP;
   measure failures and failed user journeys before adding more systems.
4. **Collect voluntary short feedback.** Ask about the biggest blocker after
   some engagement, and offer the full rewarded survey without forcing it at
   login. Review survey abandonment and free-text responses.
5. **Audit VIP conversion end to end.** Join funnel views, checkout attempts,
   confirmed paid invoices, trial expiry/entitlements and cancellation reasons.
6. **Only after activation improves:** launch a global activity feed and
   beginner-friendly asynchronous events. With fewer than two dozen weekly
   logged-in accounts, city-specific chat channels are likely to feel empty.

## Suggested success checks (initial targets, not claimed benchmarks)

- Raise the count of established accounts returning within a rolling week from
  the observed baseline of four.
- Increase the share of new accounts that start and subsequently advance a
  songwriting project, without forcing purchases or social interactions.
- Make the survey completion rate measurable while reducing unsolicited modal
  interruptions to zero.
- Confirm every accepted songwriting booking creates the authoritative linked
  session and activity exactly once, and invalid slots produce clear errors.

No external re-engagement messages should be sent until notification preferences,
consent and the intended audience are reviewed.
