# University migration timestamp-trigger replay and DJ CI release gate — 19 October 2026

## Failure investigated
The merged DJ residency booking PR #4442's Finance verification and Phase 5 SQL gates failed while rebuilding a **fresh Supabase database**, before they executed their DJ tests:

```
ERROR: trigger "set_universities_updated_at" for relation "universities" already exists (SQLSTATE 42710)
```

At least four historical migration files create the same trigger under the name `set_universities_updated_at`. Another legitimate historical schema path uses `update_universities_updated_at`. The reset migrations need to tolerate whichever path ran first.

## Changes
All four historical trigger definitions are guarded with a PostgreSQL `DO` block which checks `pg_trigger` for **either** valid trigger name and creates `set_universities_updated_at` **only if both are absent**:

- `20260401090000_create_universities_table.sql`
- `20250919082339_create_public_universities.sql`
- `20250919084140_create_universities_table.sql`
- `20250919100102_create_public_universities_table.sql`

This is a surgical compatibility fix for **fresh reset replay**. It does not rerun the original historical university `INSERT .. ON CONFLICT DO UPDATE` seed SQL against production, and does not rename existing migration identities. Historical files are edited only to make their reset-time CREATE TRIGGER semantics idempotent, rather than adding a forward-only migration that cannot execute until after the failing migration.

## Production state / direct verification
Production already has exactly **one** `update_universities_updated_at` trigger executing `public.update_updated_at_column()` on university UPDATE. It does **not** have the alternate `set_universities_updated_at` trigger, so **no production DDL application is warranted** for this defect. University data and tuition/pricing remain unchanged.

`supabase/tests/university_trigger_migration_replay_contract.sql` executed against production inside BEGIN/ROLLBACK successfully for:
1. Existing `update_universities_updated_at` trigger: replay the exact guard **four times**, assert only one timestamp trigger remains.
2. Simulated clean schema under SAVEPOINT: temporarily remove both names, replay the guard twice, verify exactly one valid trigger created, then rollback to the savepoint and finally rollback the entire test.
3. All other live university triggers and records remain unchanged.

This regression is wired into `scripts/gigs/run-db-gate.sh`. A full CI Supabase reset must still pass before it can be called green. Finance, Phase 5, and main CI failures on #4442 include unrelated historical lint and other reset tasks; this PR only addresses the observed duplicate trigger blocker so subsequent failures become visible.

DJ gig release flags `DJ_SCHEDULED_BOOKINGS_ENABLED` and `DJ_FUNDED_OWNER_BOOKINGS_ENABLED` remain disabled. Issue #4265 stays open until whole-system certification succeeds.

## Additional historical equipment-function overload repair

Issue #4334 also recorded `function name "public.purchase_equipment_item" is not unique` during DB reset. Two earlier migrations used `COMMENT ON FUNCTION public.purchase_equipment_item IS ...` without identifying the argument signature. The June and February historical migrations each define the legacy `purchase_equipment_item(uuid)`; newer migration paths also define `purchase_equipment_item(uuid,text,integer,integer)`. The comments now explicitly target **`public.purchase_equipment_item(uuid)`**, preserving the legacy overload's meaning. The July four-argument migration already names its exact signature.

Live rollback-only `supabase/tests/equipment_overload_comment_reset_contract.sql` creates two synthetic overloaded functions in a transaction-scoped schema and verifies exact-signature comments attach to the appropriate overload, then rolls back all DDL. Both this and the university trigger test are wired into the DJ database release gate. The production database currently has **no** public `purchase_equipment_item` function, so no attempt was made to create or replay an unrelated equipment-purchase implementation in production. A fresh Supabase reset still must be run by CI to confirm all historical drift is resolved; no release flag may be enabled based solely on these isolated tests.
