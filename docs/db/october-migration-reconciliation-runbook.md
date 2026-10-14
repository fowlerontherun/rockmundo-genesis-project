# October 2026 migration reconciliation: read-only gate

Tracking: #4072. **No production schema changes are made by these commands.**
History identity matches are not proof that a migration's SQL was executed or
that the expected tables, RPC signatures, grants and side effects exist.

## Export the history locally (restricted access)

In an authenticated Supabase SQL session, **read only**:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version, name;
```

Export the result as a JSON array of objects containing `version` and `name`.
Do not commit exports, connection strings, cron tokens or other production data.
Treat the export as operational evidence, not a source of truth about schema state.

## Reconcile repository files

```bash
npm run test:migration-history
npm run verify:migration-timestamps
npm run audit:migration-history -- --history /secure/history.json --output /secure/migration-review.json
```

Without `--history`, the tool still emits repository Git blob SHA-1 and SQL
SHA-256 hashes but marks all identities as unverified. The output file is
created with owner-only permissions and never overwritten. Do not store the
manifest in the source repository if it includes production history.

For each row, manually record SQL and schema verification, dependencies,
roll-forward/rollback plan and reviewer approval **outside the generated
manifest**. In particular:

- `history_identity_match_only` means the timestamp appeared in history;
  it does not authorize skipping verification.
- `not_recorded_by_version` is not evidence of missing effects: past
  deployment-time migration identities may be renamed or prefixed.
- `duplicate_timestamp_ambiguous` requires review of all SQL bodies and
  recorded releases. Never rewrite an applied migration in place.
- `manual_review_required` is mandatory for every record. No automated
  `db push`, deployment or migration marking follows from this script.

## Production deployment gates

1. Verify backup/PITR and an isolated restore rehearsal before new DDL.
2. Compare the Git SHA/SQL hash with approved deployment records, then check
   live DDL, constraints, grants, row-level security and RPC signatures.
3. Audit `SECURITY DEFINER` functions and revoke unintended public execution.
4. Test effects on staging with success, concurrency, retries, insufficient
   funds, unauthorized callers and rollback-only ledger reconciliation.
5. Deploy one **forward-only** compatibility migration at a time only after
   review; verify schema, callers and ledger balances before proceeding.
6. Never replay the applied `supabase/production-repairs` scripts, original
   destructive gig processing or obsolete direct-message fallback SQL.
7. Keep sponsorship/payroll/lottery/XP settlement cron paths single-owner and
   idempotent; never enable a duplicate job before cutover.

This runbook is a safe reconciliation aid, **not** completion of #4072.
