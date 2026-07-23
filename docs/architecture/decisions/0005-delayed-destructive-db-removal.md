# ADR 0005 — Delayed destructive database removal

Date: 2026-07-23
Status: Accepted

## Context

The legacy festival domain is 60+ tables with many FKs, RLS policies,
triggers and RPCs, some of which are still referenced by unrelated
navigation, gigs and finance code paths.

## Decision

No destructive migration ships in PR1–PR11. In PR12:

1. Rename tables into `archive_festivals.*` first.
2. Wait one release cycle with zero runtime callers.
3. Drop in a dedicated migration.

Non-destructive `COMMENT ON TABLE` markers may be added earlier to
tag legacy tables in Supabase.

## Consequences

- Slower cleanup, higher safety.
- Historical importers can still read legacy tables during transition.
- Rollback available up to the final drop PR.
