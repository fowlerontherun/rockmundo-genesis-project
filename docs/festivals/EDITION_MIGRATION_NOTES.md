# Festival edition migration notes

## Deployment review

The historical canonical-edition migration is `supabase/migrations/20291204090000_create_festival_editions.sql`. This repository checkout does not contain deployment logs proving whether that migration has or has not been applied to a shared Supabase project, so this corrective PR treats it as potentially deployed.

## Ordering decision

The `20291204090000` timestamp is retained as a historical migration identity. Renaming it alone would fix only fresh installs and could leave shared environments with divergent migration history. The hardening work therefore lives in the additive migration `20291205090000_harden_festival_editions.sql`.

Future festival migrations that depend on canonical editions must be timestamped after the historical foundation and the hardening migration, or must include idempotent bootstrap guards when they need to tolerate partially-applied environments.

## Corrected dependency order

PR #1190 created `public.public_festival_editions` before `public.is_public_festival_edition_status(status)`. PostgreSQL does not allow relying on an unresolved function reference in a view definition. The hardening migration creates or replaces the helper first, then drops and recreates the public view, reapplies grants, and performs a smoke query.

## Public/private read contract

Public discovery reads use `public.public_festival_editions`, a security-invoker/security-barrier projection that omits budgets, treasury allocations, lifecycle metadata, legacy metadata, idempotency keys and internal moderation/ownership fields. Owner and admin reads continue to use the protected `festival_editions` table through RLS-backed service functions.

## RPC semantics

`update_festival_edition_planning` now accepts a JSONB patch object so omitted keys preserve existing values while explicit `null` values clear fields where allowed. `create_festival_edition` accepts an optional idempotency key and stores it on the edition under a per-brand unique index. `transition_festival_edition` locks the edition before idempotency checks, fingerprints transition inputs and rejects reuse of a key with different inputs.

## No-op transitions

A new request that targets the edition's current status returns the unchanged edition and does not create lifecycle history. A retry with the same idempotency key returns the original locked edition after validating the fingerprint.

## Remaining limitations

Legacy stages, slots, applications, contracts, setlists, attendance and performance settlement remain keyed as they were before this PR. They are intentionally not migrated until the next canonical booking/application PR.
