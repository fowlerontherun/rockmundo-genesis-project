# Festival Creation Security

The hardened Phase 1 model treats festival creation as a server-authoritative aggregate operation.

## Authority

- Public RPCs require `auth.uid()` and the `admin` application role.
- Actor identity is stored as non-null `actor_user_id`; `actor_profile_id` is retained only for audit display when available.

## Idempotency

- Request identity is `actor_user_id + operation + idempotency_key`.
- The RPC acquires an advisory transaction lock based on actor, operation, and key before checking or inserting the request record.
- Material payload hashes use SHA-256 through `pgcrypto` and a normalized JSONB object containing only server-material fields.
- Repeating the same material request returns the original aggregate; changing material input for the same key raises `FESTIVAL_CREATE_IDEMPOTENCY_CONFLICT`.

## Validation

- The server validates dates, city, venue/city ownership, venue capacity, currency, time zone, budgets, stage uniqueness, stage type, stage capacity, and ticket ranges.
- First-edition numbering is assigned by the server; add-edition numbering is allocated from `MAX(edition_number) + 1` while the festival row is locked.

## Stage ownership consistency

- `festival_stages.edition_id` is authoritative.
- The compatibility `festival_id` column is populated from the selected edition by trigger and restored to `NOT NULL`.
- Mismatched stage festival/edition IDs are corrected before write, preventing split ownership.

## Audit

- Edition lifecycle history and admin audit history are inserted in the same transaction as festival, edition, and stage creation.
- Any failure during validation, audit, or stage insertion rolls back the aggregate and the request row.
