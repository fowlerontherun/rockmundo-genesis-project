# RockMundo Attendance and Lineup Rules

## 1. Executive Decision Summary

### Recommended beta rules

- **Rehearsal participation:** keep automatic inclusion for active player band members at booking, but add player-owned RSVP before final attendance controls.
- **Rehearsal RSVP:** support only `invited`, `confirmed`, `declined`, `attended`, and `missed` for beta. Treat `declined` as availability communication, not punishment.
- **Rehearsal attendance confirmation:** after the rehearsal, authorised managers finalise `attended` or `missed` through the guarded `finalise_rehearsal_attendance` RPC; completion contribution capture now credits only rows already finalised as `attended`.
- **Gig lineup selection:** move from automatic lineup seeding to manager-selected player performers before performance. Keep NPC/touring/session complexity out of beta unless already represented by active player membership.
- **Gig performer confirmation:** support `selected`, `confirmed`, `declined`, `performed`, and `missed` for beta; model substitution as removal plus selecting another eligible performer, not as a separate graph.
- **Missed attendance:** `missed` is an operational final status, not an automatic penalty, reputation hit, XP loss, chemistry change, or harassment signal.
- **Substitutions:** allowed before a configurable lock deadline if the substitute is eligible, active, non-blocked by schedule conflicts, and auditable.
- **Correction windows:** allow player correction requests for a short product-configurable window after finalisation; proposed default is 24 hours.
- **Disputes:** lightweight beta disputes cover incorrect `missed`, incorrect `performed`, wrongful removal, and privacy misuse; admin escalation remains manual.
- **Visibility:** operational lists remain visible to current active band members; private absence text is visible only to the player, authorised managers, and support.
- **Contribution eligibility:** create contribution only for final `attended` rehearsals and final `performed` gigs. Do not credit provisional, declined, missed, excused, cancelled, or replaced states.

### Post-beta expansion

Post-beta may add advanced substitutions, session-player marketplace integration, public lineup publishing, attendance reliability reputation, contract obligations, manager performance analytics, and richer dispute evidence.

### Rejected or deferred complexity

This design rejects beta rewards, penalties, contribution scores, XP changes, chemistry changes, automatic reputation damage, role-balancing algorithms, public absence feeds, and a full arbitration system.

## 2. Existing Repository Behaviour

### Rehearsals

- `band_rehearsals` stores band, room, scheduled start/end, status, cost, chemistry, XP, creation, and completion fields. Initial table statuses are `in_progress`, `completed`, and `cancelled`; current booking code inserts `scheduled`, so status normalization should be reviewed before mutation RPCs.
- Booking uses `useRehearsalBooking`, validates future time, checks all real non-touring band members for schedule conflicts, inserts a rehearsal, deducts cost, creates member schedule activities, and invalidates rehearsal/schedule queries.
- `bandActivityScheduling` intentionally fetches active real player members only (`user_id` present and `is_touring_member = false`) for schedule blocking and conflict checks.
- PR 03 added `band_rehearsal_participants` with `invited`, `attended`, and `missed`; rows are private to active band members through RLS.
- Rehearsal participant rows are automatically seeded on rehearsal insert for active members with a profile. Current seeding does not exclude touring members.
- Rehearsal completion calls `capture_contributions_for_rehearsal`, seeds missing rows, and creates contribution events for rows already finalised as `attended` only; it no longer auto-promotes remaining `invited` rows to `attended`.
- Existing schedule records are `player_scheduled_activities` linked to `linked_rehearsal_id`; they are the schedule source. Participant rows are evidence, not duplicate schedules.
- Cancellation behaviour is partial: seeding skips cancelled rehearsals, schedule status supports `cancelled`, but no participant cancellation lifecycle or RSVP release flow exists.
- Read-only UI exists on rehearsal cards through participant detail hooks and shared status display; Phase 4 PR 06 adds player-owned rehearsal self-response controls for the active user's own row before the one-hour RSVP deadline. Manager attendance mutation UI now exists narrowly on the rehearsal participant surface for authorised managers after the rehearsal is eligible for finalisation.

### Gigs

- `gigs` stores venue, band, scheduled date, payment, status, attendance, fan gain, and timestamps.
- `gig_outcomes` records completed gig financial/performance results. Gig completion code inserts an outcome, song performances, sets the gig to completed, updates country performance, balance, fame, chemistry, and XP through existing performance flows; this rules PR does not change those systems.
- PR 03 added `gig_performers` with `selected`, `performed`, and `missed`; rows are private to active band members through RLS.
- Gig performer rows are automatically seeded on gig insert for active, non-touring player members and copy `instrument_role` or `role` into `role_or_instrument`.
- Gig outcome capture calls `capture_contributions_for_gig_outcome`, seeds missing performers, changes remaining `selected` rows to `performed`, and creates contribution events for `performed` only.
- Existing schedule records support `linked_gig_id`; future lineup removal should release or cancel only that member's schedule block when a per-member block exists.
- Cancellation behaviour is partial: performer seeding skips `cancelled` and `failed` gigs, but no explicit lineup cancellation or correction state exists.
- Read-only UI exists on gig detail through performer detail hooks and shared status display; no lineup editor, confirmation, substitute, or finalisation UI exists.

## 3. Design Principles

1. Contribution must reflect real participation.
2. Managers must not be able to fabricate performance without an auditable finalisation trail.
3. Players must be able to communicate availability before consequences are considered.
4. Solo and casual players should not be unfairly punished for not joining highly scheduled bands.
5. Missed attendance must not become a harassment tool.
6. Final records should be auditable.
7. Corrections must be time-limited.
8. Private absence reasons should remain private.
9. Contribution and punishment must be separate concepts.
10. Beta rules should remain simple and implementable in small PRs.

## 4. Rehearsal Participation Lifecycle

Recommended beta states: `invited`, `confirmed`, `declined`, `attended`, `missed`, plus source-level `cancelled` through the rehearsal row rather than participant status.

| State | Who can set | When | Final? | Schedule block | Contribution | Visible to band | Correctable | Notification |
|---|---|---|---|---|---|---|---|---|
| `invited` | System on booking | At booking | Provisional | Yes by default | No | Yes | Yes | Added to rehearsal |
| `confirmed` | Participant | Before RSVP deadline | Provisional | Yes | No | Yes | Yes | Confirmation summary/dedupe |
| `declined` | Participant | Before RSVP deadline | Provisional | Releases active block where feasible; remains visible as declined history | No | Status visible; private reason hidden | Yes before deadline | Manager informational |
| `attended` | Authorised manager or finalisation job | After rehearsal starts/ends | Final after lock | Yes/history | Yes | Yes | Correction window | Participant informational |
| `missed` | Authorised manager only | After rehearsal start/end | Final after lock | History only | No | Yes | Correction/dispute window | Participant actionable |
| Source `cancelled` | Existing rehearsal cancellation authority | Before completion | Final | Cancel/release schedules | No | Yes | Admin only after cancellation | All participants informational |

Product answers:

- **Are all active members included automatically?** Beta may keep automatic inclusion for active player members, but should exclude touring/NPC members unless product explicitly opts in.
- **Can members opt out before a deadline?** Yes, through `declined` before the RSVP deadline.
- **Does declining remove the activity from schedule?** Recommended yes for active schedule blocking, while retaining declined history on the rehearsal.
- **Can a leader override a decline?** No. Leaders may ask again or reschedule, but should not convert `declined` to expected.
- **Who marks attended or missed?** Authorised leader/founder/officer through server RPC; ordinary members cannot mark others.
- **Should completion automatically mark confirmed members attended?** For beta, automatic `attended` may remain a fallback, but explicit manager finalisation should replace it before consequences exist.
- **Should no-response members count as expected?** Yes for schedule/conflict purposes until the RSVP deadline; no for penalties.
- **Should touring members be included?** No by default for beta because schedule code excludes them and many lack player identity.
- **Should inactive members ever be included?** No for future events; preserve historical rows.
- **How should a member leaving before rehearsal be handled?** Keep the historical participant row, stop future schedule blocking, and finalise as removed/no-credit rather than `missed` unless they attended before leaving.

## 5. Gig Lineup Lifecycle

Recommended beta states: `selected`, `confirmed`, `declined`, `performed`, `missed`, with `withdrawn`/`replaced` represented by audited removal plus replacement selection rather than persistent public states.

| State | Meaning | Who sets | Timing | Contribution | Schedule effect |
|---|---|---|---|---|---|
| `selected` | Manager picked performer | Authorised manager/system migration fallback | Before lineup lock | No | Blocks selected performer |
| `confirmed` | Performer accepts slot | Selected performer | Before confirmation deadline | No | Keeps block |
| `declined` | Performer refuses slot | Selected performer | Before self-withdrawal deadline | No | Releases block, keeps history |
| `performed` | Final performer credit | Authorised manager/finalisation job | At/after gig completion | Yes | Historical |
| `missed` | Expected performer did not perform | Authorised manager | At/after gig start | No | Historical and disputable |

Rules:

- Initial lineup should be manager-selected. Existing automatic seeding can remain as transitional fallback until a lineup editor exists.
- Band leader/founder/authorised officer may edit lineup before lock.
- Performers may confirm or decline their own selection.
- Proposed default lineup edit lock: several hours before gig; product-configurable.
- Substitutes are selected by removing/declining one performer and adding another eligible active player before lock; late changes require manager action and audit.
- Touring/NPC members remain excluded from beta contribution unless they map to a real active profile.
- Final gig outcome locks the lineup for normal managers; corrections go through a correction/dispute flow.
- Completed lineups can be corrected only during a short window or by support.

Product answers:

- **Must every active musician be selected?** No. Lineups are manager-selected.
- **Can managers/non-performing staff be excluded?** Yes.
- **Can one role have multiple performers?** Yes if product allows it; beta should not enforce role balancing beyond existing member labels.
- **Can session musicians be selected?** Defer unless represented as active player band members or a future contract/session system.
- **Can a player perform in overlapping gigs?** No; late additions must pass conflict validation.
- **What if a performer leaves after selection?** Preserve historical selection, release future block, require replacement if needed, and do not mark missed solely for leaving.
- **What if lineup becomes incomplete?** Warn managers and allow completion only if existing gameplay already permits gig completion; do not invent new hard blockers without product approval.
- **Should a gig be blocked from completion without required roles?** Defer. Existing gameplay does not prove a required-role matrix.

## 6. Permissions Matrix

| Actor | View participant list | Confirm own | Decline own | Select lineup | Remove performer | Mark missed | Mark attended/performed | Correct final status | View private absence reason | Resolve dispute | View audit history |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Band leader | Yes | Own rows | Own rows | Yes | Yes | Yes | Yes | During window | Manager-visible only | Yes, unless self-conflicted | Band audit |
| Band founder | Yes if active | Own rows | Own rows | Yes | Yes | Yes | Yes | During window | Manager-visible only | Yes, unless self-conflicted | Band audit |
| Authorised band officer | Yes | Own rows | Own rows | Yes if permissioned | Yes if permissioned | Yes if permissioned | Yes if permissioned | During window if permissioned | Manager-visible only | Yes if permissioned | Band audit subset |
| Ordinary member | Yes | Own rows | Own rows | No | No | No | No | Request only | Own reason only | No | Own audit subset |
| Selected performer | Yes | Own gig row | Own gig row | No | Self-withdraw only | No | No | Request only | Own reason only | No | Own audit subset |
| Invited rehearsal participant | Yes | Own rehearsal row | Own rehearsal row | No | No | No | No | Request only | Own reason only | No | Own audit subset |
| Former member | Historical self rows only | No | No | No | No | No | No | Request support only | Own reason only | No | Own historical subset |
| Admin/support | As needed | No gameplay action | No gameplay action | Support override only | Support override only | Support override only | Support override only | Yes | Yes under policy | Yes | Full support audit |

Every mutation must be server-authoritative and validate actor identity, active membership, role permission, target membership, source event status, timing window, idempotency, conflicts, and audit logging.

## 7. Timing and Lock Rules

All values below are proposed defaults, not final balance values.

| Rule | Proposed default | Product note |
|---|---:|---|
| Rehearsal RSVP deadline | 1 hour before start | Configurable by product; must show in UI |
| Lineup edit deadline | 4 hours before gig | Shorter for casual gigs may be allowed later |
| Self-withdrawal deadline | Same as lineup lock | Late withdrawal becomes manager-handled |
| Final attendance locking | 24 hours after rehearsal end | Managers can finalise earlier |
| Correction window | 24 hours after finalisation | Extendable by support |
| Dispute submission window | 48 hours after finalisation | Product-configurable |
| Admin correction window | No strict beta limit, but audit required | Support policy decision |

## 8. Attendance and Schedule Integration

- Activities block schedules when a player is expected to attend: `invited`/`confirmed` rehearsal rows and `selected`/`confirmed` gig rows.
- Declined rehearsal/gig rows remain visible as operational history but should release active schedule blocks where a per-member schedule block exists.
- Confirmed activities appear as normal scheduled activities with status labels in detail views.
- Cancellation sets source activity/schedule records to cancelled and sends informational notifications; no contribution is created.
- Conflicts are checked against `player_scheduled_activities` with overlapping `scheduled`/`in_progress` rows.
- Store and compare times as `timestamptz`; render in the player's local timezone.
- Lineup removal releases that performer's block; late additions must pass conflict validation.
- Avoid duplicate schedule records. Keep rehearsal/gig rows as primary source and use participant/performer rows for member-level expectation evidence.

## 9. Contribution Eligibility

- **Rehearsal:** create contribution only for final `attended`.
- **Gig:** create contribution only for final `performed`.
- No contribution for `invited`, `confirmed`, `declined`, `missed`, `excused`, `selected`, `withdrawn`, `replaced`, or cancelled source events.
- Contribution insertion must remain idempotent using source identity plus band/profile/type uniqueness.
- Validate event-time membership where schema supports it; preserve historical rows even if later membership changes.
- Corrections should use append-only correction metadata/events rather than silently rewriting immutable contribution history.
- If an incorrect contribution exists, prefer a compensating correction record or `voided_by_correction_id` style design in a future migration rather than hard delete.
- Do not add reward values, XP, chemistry, or contribution scores in attendance/lineup PRs.

## 10. Absence Reasons and Privacy

Absence reasons should exist post-RSVP as optional metadata, but not in this documentation PR.

Recommended safe default:

- Optional, never required.
- Private to the player, authorised managers, and admin/support.
- Maximum length: proposed 280 characters.
- Retention: same as operational participant row unless support policy requires deletion/anonymisation.
- Moderation: reportable if abusive; support-visible.
- No impact on contribution eligibility.
- No automatic reputation or punishment effect.
- Not shown in contribution feeds, public profiles, public gig pages, or general audit metadata.

## 11. Disputes and Corrections

Lightweight beta model:

- A participant/performer can dispute their own final `missed`, missing `attended/performed`, wrongful removal, or exposed private reason.
- Managers can request correction of accidental finalisation mistakes.
- Proposed submission limit: 48 hours after finalisation.
- Evidence available: source event, schedule rows, participant/performer status history, audit records, notifications, and manager notes; not private DM scraping.
- Resolution: an authorised manager who did not make the disputed action when possible; admin/support can override.
- The manager who made the disputed decision should not be sole resolver if another authorised manager exists.
- Notifications are sent on open and resolution, deduped by source row.
- Contribution corrections create or void eligibility through an auditable correction path, not hidden history edits.

## 12. Notifications

| Event | Type | Route | Privacy/dedupe |
|---|---|---|---|
| Added to rehearsal | Actionable | Rehearsal detail/schedule | One per participant/source |
| Rehearsal approaching | Informational | Schedule | Existing reminder rules; no spam |
| Participation confirmed | Informational to managers | Rehearsal detail | Batch/dedupe |
| Participation declined | Informational to managers | Rehearsal detail | Do not include private reason in notification body |
| Marked missed | Actionable to participant | Rehearsal detail/correction | One per final status |
| Added to gig lineup | Actionable | Gig detail | One per performer/source |
| Removed from lineup | Informational/actionable | Gig detail | Include safe reason category only |
| Lineup changed | Informational | Gig detail | Batch multiple changes |
| Marked performed/missed | Informational/actionable | Gig detail | Actionable for `missed` |
| Dispute opened | Actionable to resolvers | Detail/admin queue | One per dispute |
| Dispute resolved | Informational/actionable | Detail | Include outcome, not private evidence |

Notification-storm prevention should batch manager summaries, dedupe by source row and status, and suppress repeated status-change notifications within a short window.

## 13. Audit Requirements

Audit records should be written for participant added, response changed, lineup changed, performer removed, attendance finalised, performance finalised, correction applied, dispute opened, dispute resolved, and denied permission attempt.

Each audit record should include actor, target profile, source event, previous status, new status, timestamp, actor role, safe reason category, request id/idempotency key, and denied validation reason where applicable. Do not store private free-text absence reasons in general audit metadata.

## 14. RLS and Backend Design

| RPC | Authorised actor | Inputs | Validations/transitions | Idempotency/audit/notifications |
|---|---|---|---|---|
| `respond_to_rehearsal_invitation` | Invited active participant | rehearsal id, response, optional private reason | Own row, before RSVP deadline, `invited/confirmed/declined` transitions | Idempotent same response; audit response; notify managers |
| `set_rehearsal_attendance` | Leader/founder/officer | rehearsal id, profile id, final status | Active manager, event started/ended, target row exists, no cancelled source | Audit previous/new; notify target; no contribution until finalise |
| `finalise_rehearsal_attendance` | Leader/founder/officer/system | rehearsal id | Event complete, deadline/window, statuses valid | Idempotent; create contribution for `attended`; notify summary |
| `update_gig_lineup` | Leader/founder/officer | gig id, add/remove performer ids, roles | Active manager, before lock or special late-change permission, conflict checks | Idempotency key; audit changes; notify affected performers |
| `respond_to_gig_selection` | Selected performer | gig id, response, optional private reason | Own row, before self-withdrawal deadline | Audit response; notify managers; release block on decline |
| `finalise_gig_performance` | Leader/founder/officer/system | gig/outcome id, performer statuses | Outcome exists, source not cancelled/failed, statuses valid | Contribution for `performed`; audit; notify missed/performed |
| `request_participation_correction` | Affected participant/manager | source row id, requested status, safe reason category | Within correction/dispute window, actor relationship | Idempotent open request; audit; notify resolvers |
| `resolve_participation_correction` | Non-conflicted manager/admin | request id, outcome, safe reason category | Permission, open request, allowed transition | Audit resolution; notify parties; apply contribution correction |

RLS should allow direct SELECT only to current active band members and self/historical subsets where explicitly needed. Direct client INSERT/UPDATE/DELETE should remain denied; RPCs enforce mutations.

## 15. UI Plan

Rehearsals:

- Add self RSVP control to existing rehearsal detail/card surfaces.
- Display RSVP deadline and current status.
- Keep participant status list compact.
- Add manager finalisation controls only after server RPCs exist.
- Show final read-only attendance after lock.
- Add correction request entry point for affected players.

Gigs:

- Add a small lineup manager to existing gig detail/management surfaces.
- Add self confirmation/decline for selected performers.
- Display lineup lock deadline.
- Show final performed/missed status after outcome.
- Add correction request entry point.

Keep the current FM/RockMundo card/table style; do not redesign rehearsal or gig pages.

## 16. Anti-Abuse Analysis

| Risk | Prevention | Detection | Moderation response | Audit requirement |
|---|---|---|---|---|
| Leaders falsely marking missed | Correction window, no automatic penalties, manager permission checks | High missed rate by manager | Reverse status, warn/sanction | Actor, target, source, old/new |
| Members confirming but not attending | Final manager confirmation, no auto contribution for confirmed | Repeated confirm/miss pattern | Future reputation only post-beta | Response and final status history |
| Contribution farming | Final statuses only, source uniqueness, conflict checks | Duplicate/overlapping events | Void contribution corrections | Idempotency/source audit |
| Repeated status changes | Lock windows, dedupe notifications | Churn counters | Rate limits | Every transition |
| Alt accounts | Membership checks, conflict validation, support review | Shared patterns/manual review | Account action if abusive | Actor/target linkage |
| Revenge removals | Lock windows, correction/dispute, no public shame | Late removals by manager | Restore/discipline | Removal reason category |
| Lineup exclusion harassment | Transparency to member, disputes for abusive removal | Pattern of exclusions | Band/support intervention | Lineup change history |
| Notification spam | Dedupe/batching | High notification count | Rate limit | Notification source ids |
| Schedule griefing | Decline releases block, conflict checks | Frequent forced bookings | Permission limits | Booking and response audit |
| Managers changing after completion | Final locks and correction RPC only | Post-lock mutation attempts | Deny/escalate | Denied attempt audit |
| Manipulated correction requests | Time limits and scoped reasons | Repeated rejected requests | Cooldown/support | Request/resolution audit |

## 17. Recommended Beta Rules

1. Rehearsals invite active player members by default; touring/NPC inclusion is off by default.
2. Members can confirm or decline before a visible RSVP deadline.
3. Decline releases active schedule blocking where possible and never creates contribution or penalty.
4. Managers finalise attendance as `attended` or `missed`; `missed` has no automatic punishment.
5. Gigs use manager-selected lineups; automatic seeding remains only as migration/fallback until editor exists.
6. Selected performers can confirm or decline before lock.
7. Lineups lock before the gig; late changes require manager permission and audit.
8. Contribution is created only for final `attended` rehearsals and final `performed` gigs.
9. Private absence reasons are optional, manager-visible only, and not used for automatic consequences.
10. Corrections/disputes are lightweight, time-limited, auditable, and support-escalatable.

## 18. Deferred Post-Beta Features

- Advanced substitutions.
- Session-player marketplace integration.
- Attendance reliability reputation.
- Contract attendance obligations.
- Automated penalties.
- Manager performance scores.
- Complex lineup optimisation.
- Public performer lineups.
- Detailed absence analytics.

## 19. Delivery Plan

### Phase 4 PR 06

- **Objective:** Rehearsal self-response MVP.
- **Scope:** Add `confirmed/declined`, self-response RPC, deadline display, private reason placeholder if approved.
- **Database impact:** Status constraint migration, response timestamps/deadline metadata if needed.
- **Security impact:** Own-row RPC, no direct table updates.
- **Dependencies:** Product approval for RSVP deadline and private reason storage.
- **Acceptance criteria:** Participant can confirm/decline own future rehearsal; managers can view status; schedule block released on decline if supported.
- **Tests:** RPC permission/idempotency, RLS, UI no-manager mutation.
- **Risk:** Status constraint migrations against existing rows.

### Phase 4 PR 07

- **Objective:** Leader rehearsal finalisation MVP.
- **Scope:** Manager attendance finalisation and contribution capture alignment.
- **Database impact:** Audit table or social audit extension; finalised timestamp.
- **Security impact:** Leader/founder/officer permission checks.
- **Dependencies:** PR 06 statuses.
- **Acceptance criteria:** Only authorised managers finalise; only `attended` creates contribution; missed not penalised.
- **Tests:** RPC permissions, contribution idempotency, denied attempts.
- **Risk:** Existing automatic completion must be carefully preserved or replaced.

### Phase 4 PR 08

- **Objective:** Gig lineup management MVP.
- **Scope:** Manager add/remove performer before lock, conflict checks, schedule release/add.
- **Database impact:** Add `confirmed/declined`, lock fields if approved, audit records.
- **Security impact:** Manager-only lineup mutation RPC.
- **Dependencies:** Product approval for lineup lock defaults.
- **Acceptance criteria:** Managers can select active eligible performers; direct mutations denied; affected performers notified.
- **Tests:** Active membership, touring exclusion, conflicts, idempotency.
- **Risk:** Interaction with existing auto-seeding and booking flows.

### Phase 4 PR 09

- **Objective:** Performer confirmation and lineup lock MVP.
- **Scope:** Performer self confirm/decline, lock display, final performance status alignment.
- **Database impact:** Confirmation timestamp and lock metadata if not added in PR 08.
- **Security impact:** Own-row response RPC.
- **Dependencies:** PR 08.
- **Acceptance criteria:** Selected performers can respond before lock; declines release blocks; final `performed` only contributes.
- **Tests:** Permission, deadline, notification dedupe.
- **Risk:** Late gig changes need clear UX.

### Phase 4 PR 10

- **Objective:** Correction/dispute MVP and Phase 4 review.
- **Scope:** Correction request/resolve RPCs, audit display subset, docs review.
- **Database impact:** Correction/dispute table and contribution correction model.
- **Security impact:** Resolver permission and admin override.
- **Dependencies:** PR 07 and PR 09 final states.
- **Acceptance criteria:** Affected players can request correction; authorised resolver can apply auditable changes; contribution correction is idempotent.
- **Tests:** Windows, resolver conflict, correction effects, privacy.
- **Risk:** Scope creep into full moderation system.

## 20. Open Product Decisions

| Decision | Status |
|---|---|
| Exact RSVP deadline default | Required before implementation; safe default available |
| Exact lineup lock default | Required before implementation; safe default available |
| Whether touring members can ever receive rehearsal participation rows | Required before implementation; safe default is no |
| Whether NPC/session musicians can be lineups in beta | Safe default available: defer |
| Whether a decline releases schedule block immediately | Required before implementation; safe default is yes |
| Whether finalisation auto-attends confirmed/no-response rows | Required before PR 07; safe fallback exists |
| Officer role names and permission source | Required before manager RPCs |
| Absence reason storage and retention | Required before storing reasons |
| Correction/dispute windows | Required before PR 10; safe defaults available |
| Contribution correction storage model | Required before PR 10 |
| Public lineup visibility | Post-beta decision |
| Automated penalties/reputation | Post-beta decision |
| Required-role gig completion blocking | Post-beta decision unless gameplay owners require beta |


### Phase 4 PR 08 implementation status — rehearsal attendance corrections

Rehearsal attendance correction requests are now implemented for final `attended` ↔ `missed` rows only. Affected participants can open one pending request within the 24-hour database-enforced correction window; authorised current managers or admin/support resolvers can approve or reject through guarded RPCs. The workflow preserves append-only audit history, keeps request reasons and resolution notes private, sends deduped resolver/requester notifications, and corrects rehearsal contribution eligibility by inserting missed-to-attended events idempotently or voiding attended-to-missed events without deleting the original contribution row. Gig lineup management, performer confirmation, gig disputes, absence reasons, rewards, penalties, XP, chemistry, reputation, attendance percentages, and reliability scoring remain out of scope.

## Phase 4 PR 09 status

- Attendance corrections now have authoritative per-participant finaliser references, server-side original-finaliser conflict enforcement, sole-resolver exception auditing, legacy-null fallback handling, read-only correction history, and a repeatable correction SQL harness. Gig lineup management remains not complete.

## Phase 4 PR 10 release-gate status

- Phase 4 PR 10 reviewed the rehearsal attendance correction lifecycle as a release gate before gig-lineup mutation work.
- The correction SQL harness was expanded with executable assertions for required tables/columns/RPCs, authenticated-only correction grants, anonymous execute denial, RLS enablement, voided contribution filtering/index expectations, privacy static checks, and fixture-capability prerequisites.
- Local Supabase reset and SQL harness execution were not completed in the PR 10 environment because the Supabase CLI was unavailable.
- Static migration-order review found a blocker: the Phase 4 attendance/correction migrations dated `20260711...` reference `band_rehearsal_participants`, but the migration that creates that table is dated `20290711030000` and sorts later. This must be corrected and verified before beta release-gate approval.
- Phase 4 is therefore not complete, and gig-lineup mutation should not begin until a clean reset and participant/correction harness run pass.

## Phase 4 PR 11 implementation-status note

The migration-order defect that placed `band_rehearsal_participants` after the RSVP/finalisation/correction migrations has been repaired in the repository with earlier bootstrap migrations and idempotent late policy handling. This is a schema-order repair only: it does not add gig lineup mutation, performer confirmation, rewards, penalties, XP, chemistry, reputation, or scoring. A real clean Supabase reset and SQL harness execution remain required before these rules are considered database-gate verified.
