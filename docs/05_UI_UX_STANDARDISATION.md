# Database Stabilisation Plan

## Purpose

Prepare the Supabase database for beta by reducing migration risk, improving data integrity, and making setup reproducible.

This is not a schema rewrite.

## Current risk

The repository contains a large number of migrations. That is normal for rapid development, but it increases beta risk:

- hard to create fresh environments
- easier to introduce duplicate schema changes
- harder to identify current truth
- harder to debug onboarding/tester setup

## Beta database goal

A new developer or beta environment should be able to create a working database reliably.

## Phase 1: Migration inventory

Create:

```text
docs/database/MIGRATION_INVENTORY.md
```

For each migration group, document:

- file name
- purpose
- affected tables
- beta critical? yes/no
- can be archived later? yes/no

## Phase 2: Beta schema baseline

Create a beta baseline SQL file:

```text
supabase/baseline/beta_schema.sql
```

This should represent the current desired schema for new beta environments.

Keep existing migrations for history, but use the baseline for cleaner test setup where possible.

## Phase 3: Core table audit

Audit tables used by:

- auth/profile creation
- dashboard
- character state
- money
- XP
- skills
- songs
- recordings
- releases
- bands
- notifications

For each table, verify:

- primary key
- foreign keys
- indexes
- RLS policy
- created_at/updated_at
- sensible constraints
- seed/reference data dependency

## Phase 4: RLS audit

For every beta core table, document:

| Table | Read policy | Insert policy | Update policy | Delete policy | Notes |
|---|---|---|---|---|---|

Rules:

- player-owned data must only be accessible to the owning player unless intentionally public
- public world data can be readable by all authenticated users
- admin-only tables must not be user-writable
- economy/progression tables need stricter validation

## Phase 5: Data integrity constraints

Add constraints where safe:

- health 0–100
- energy 0–100
- happiness 0–100 where applicable
- money minimum where applicable
- XP not negative where applicable
- status values limited to known values
- dates not impossible

Use database constraints to prevent impossible state.

## Phase 6: Ledger discipline

For important resources, use ledger/audit tables where possible:

- XP
- money
- fans
- reputation
- premium entitlements
- admin adjustments

Beta minimum:

- XP changes should be traceable
- money changes should be traceable
- premium/purchase-related changes must be traceable before real payments

## Phase 7: Index review

Index common access patterns:

- `profile_id`
- `user_id`
- `band_id`
- `song_id`
- `created_at`
- `status`
- `city_id`

Add composite indexes for common filters:

```sql
(profile_id, created_at)
(profile_id, status)
(band_id, created_at)
(city_id, event_date)
```

Only add indexes where queries justify them.

## Phase 8: Seed data validation

Create a seed validation checklist:

- genres exist
- starter cities exist
- starter skills exist
- starter activities exist
- default profile values exist
- onboarding can run without null reference data

## Phase 9: Database test script

Create a test script or SQL checklist that verifies:

- migrations apply
- required tables exist
- RLS policies are enabled
- basic profile insert works
- starter data exists
- common queries return expected shape

## Beta database release rules

During beta:

- no unreviewed destructive migrations
- no dropping columns without migration plan
- no changing status strings without data migration
- no new economy table without audit plan
- no new player-owned table without RLS

## Production warning

Do not connect payment/real-money systems until:

- entitlements are auditable
- admin adjustments are logged
- purchase records are immutable
- refund flow is documented
- access is server validated

## Database beta acceptance criteria

- Fresh beta database can be created from documented steps.
- Character creation succeeds repeatedly.
- Dashboard queries work for new and existing profiles.
- Core music loop persists reliably.
- No obvious orphan records in beta core tables.
- RLS policies pass manual checks.
- No critical economy/progression value can be trivially modified from the client.
