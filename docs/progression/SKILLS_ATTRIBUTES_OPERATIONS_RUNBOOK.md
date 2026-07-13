# Skills and Attributes Operations Runbook

This runbook is for support, balance admins and engineers. Start with the player profile id, source event id and balance version.

## Common issues

| Issue | First checks | Safe action | Escalate when |
|---|---|---|---|
| Missing skill | catalogue slug, unlock route, prerequisites, RLS profile access | rerun catalogue validation; inspect player skill row | row is orphaned or hidden content leaks |
| Stale attributes | attribute row exists, AP ledger, cache refresh | refresh query; verify AP spend ledger | AP balance negative or duplicate spend |
| Reward not received | source event id, idempotency key, ledger row | replay only with admin repair dry run first | duplicate event exists |
| Outcome looks wrong | captured balance version, outcome breakdown, contributors | compare with calculator preview using captured version | version missing on new outcome |
| Legacy incomplete record | created before version capture, missing breakdown | show explicit legacy state | user progress appears lost |

## Repair workflow

1. Confirm admin authorization.
2. Run dry run.
3. Review affected record count and sample rows.
4. Apply with explicit reason and source ticket.
5. Store audit log and rerun validation.

## Adding content

New skills, attributes, mastery paths and UI descriptions must follow `ADDING_SKILLS_AND_ATTRIBUTES.md`. Do not release content until validation, simulations and translations pass.

## Emergency procedures

If rewards duplicate, disable the relevant server action, preserve ledgers, identify idempotency scope and repair by compensating ledger events rather than deleting history. If a balance config is bad, roll forward to a corrected version; do not mutate completed outcome versions.
