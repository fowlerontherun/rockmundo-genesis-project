# Finance A4 verification scope

The existing `Finance verification` workflow is the authoritative A4 release gate. This branch extends its Playwright coverage to include rehearsal, recording, loan-application, and mortgage routes while retaining the existing clean Supabase reset, database tests/lint, reconciliation, generated-type parity, frontend checks, and build.

The backlog should only move to `COMPLETE` after the pull-request workflow succeeds.
