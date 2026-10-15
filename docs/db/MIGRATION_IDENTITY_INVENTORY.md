# Migration identity inventory (read-only, issue #4072)

This inventory detects source collisions before a migration deployment. It is
**not** a migration runner, a schema diff or a record of successful application.

Run without any database connection:

```sh
node --test tests/migrationIdentityInventory.test.mjs
node scripts/migration-identity-inventory.mjs --output migration-identity-report.json
```

Optionally compare version identities to a **sanitized**, locally supplied array
exported from the migration history, without SQL statements or credentials:

```sh
node scripts/migration-identity-inventory.mjs \
  --history-json /path/to/sanitized-history-versions.json \
  --output migration-identity-report.json
```

History JSON may be `["20261015120000", ...]` or an array of objects with a
`version` property. Never commit a production history export or secrets.

## Read the report correctly

- `duplicate_timestamp_groups`: more than one repository SQL file declares
  the same filename version, potentially with **different contents**. Resolve
  each collision manually; do not arbitrarily rename a previously deployed file.
- `identical_sql_groups`: same source bytes appear at multiple paths. This
  is evidence of a rename/duplicate, **not** proof either was deployed.
- `history_identity=version_matched_unverified` means the version string
  appears in the supplied history. It does *not* mean the current SQL bytes
  executed or the resulting functions, triggers and grants still exist.
- `history_identity=version_missing_unverified` likewise is not proof the
  SQL is missing: historical jobs used deployment-time version prefixes.
- Every `schema_effects` value remains `not_verified` and every
  `deployment_decision` is `manual_review_required`.

The workflow `migration-identity-inventory.yml` runs Node tests and uploads
this report without contacting Supabase. It deliberately does not reject all
existing timestamp collisions, because historical duplicates predate the
workflow and need a reviewed, non-destructive reconciliation.

Before changing production, reconcile each candidate to its Git blob hash,
dependency order, exact current schema and function grants, an isolated
staging test, and an approved backup/rollback checkpoint. **Never run
`supabase db push` or bulk-apply historical SQL based on this report.**
