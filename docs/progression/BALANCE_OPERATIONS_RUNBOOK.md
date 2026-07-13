# Balance Operations Runbook

## Safe workflow
1. Open the admin balance dashboard and review the active version, warnings and recent activation history.
2. Clone the active version into a draft. Drafts do not affect gameplay.
3. Edit supported fields with structured forms: XP curves, practice limits, attribute costs, learning caps, outcome weights, mastery ranks and maintenance policies.
4. Add a plain-language change summary.
5. Run validation. Critical failures must be fixed; warnings require reviewer acknowledgement.
6. Run core simulations and compare current vs proposed outcomes.
7. Request approval from an authorised approver.
8. Schedule activation or activate immediately. The server revalidates and records audit metadata.
9. After activation, check cache-version health and a small set of new activities.

## Interpreting results
- **Critical:** blocks activation; usually impossible progression, invalid weights, unsafe caps or exploit-sized repeatable rewards.
- **Warning:** risky but possibly intentional; document reviewer rationale.
- **Info:** useful context such as fairness shifts.

## Rollback
Rollback reactivates a previous valid config for new calculations. It does not delete the newer version and does not rewrite completed songs, recordings, gigs, rewards, AP spends or ledgers. If a schema/data migration shipped with the balance change, treat configuration rollback and database rollback separately.

## Long-running activities
Activities keep the captured version from start/lock time. Newly started work after activation uses the new active version. If a report shows mixed versions within a single calculation, treat it as an incident.

## Emergency procedure
1. Stop scheduling additional versions.
2. Roll back configuration to the last valid version.
3. Confirm audit log and cache invalidation completed.
4. Review duplicate active version, unknown active version and reward spike alerts.
5. Decide separately whether a database migration needs a manual forward fix.

## Common failure modes
Invalid weight totals, negative rewards, stale UI descriptions, duplicate active versions, missing catalogue keys, practice/teaching farming, repeatable achievement loops and migrations that assume old formulas.

## Player progress rules
Never rewrite completed historical outcomes for a config rollback. Preserve levels, XP ledgers, AP spend records and outcome snapshots. Use migration-impact simulations before changing curves or costs.
