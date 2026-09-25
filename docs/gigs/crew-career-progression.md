# Gig crew career progression

## What earns crew experience

Only a hired employee with an **accepted named assignment to the completed gig** earns career XP and cohesion. Assignment is locked after the gig starts. Unassigned and declined staff do not contribute to show quality, do not appear on that show's payroll and receive no XP.

The gig-completion trigger writes a unique `(gig_id, crew_member_id)` settlement first, then increments `career_xp`, `gigs_together`, `skill_level` and `cohesion_rating` in the same transaction.

| Venue capacity | Base XP per attended gig |
|---|---:|
| 0–500 | 10 |
| 501–1,500 | 15 |
| 1,501–5,000 | 20 |
| Over 5,000 | 25 |

A gig rated 18/25 or higher adds 5 XP. Every 100 career XP earns a technical skill point, capped at skill 100. Every attended gig also increases cohesion by 2, or 3 for a performance rated at least 18/25, capped at 100.

The assignment's server-derived contracted wage is included in the gig's final crew costs. Gig completion now fails and enters the existing retry mechanism if its authoritative preparation-cost query cannot return a breakdown, rather than recording an incorrect zero salary.

## Failed settlements

`reconcile_unsettled_completed_gig_crew(limit)` is service-role-only. The existing `auto-complete-gigs` worker calls it during its normal retry pass. It scans no more than 100 completed gigs at a time and considers **only** accepted, previously saved assignments with an eligible member and a final gig outcome. The original unique-ledger settlement function makes recovery idempotent. A failure is logged without blocking other gigs.

Do **not** create historic assignments based solely on today's roster or automatically award pre-migration gigs. That would misattribute work performed before a crew member joined.

## Player-facing records

Crew Management shows career XP and opens each employee's ten most recent verified settlements, including skill growth, cohesion and wages. The gig result report separately displays the workers rewarded for that particular show. The roster's total wage estimate represents the cost if all hired crew attend; the individual gig preparation screen shows the actual confirmed payroll.

## Validation

- `npm run test:crew` runs role-specific crew scoring and career history UI tests.
- `npm run test:crew:db` runs a structural/authorization test and, if an eligible fixture exists, creates a temporary gig assignment, reconciles twice and verifies that XP and wages are credited exactly once. The entire test transaction is rolled back.
- Production checks should confirm that the new SQL routine is callable only by `service_role`, that the gig worker's recovery summary logs success or actionable errors, and that completed gig totals have never silently omitted confirmed crew wages.
