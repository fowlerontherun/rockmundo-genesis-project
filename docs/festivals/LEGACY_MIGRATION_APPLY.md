# Legacy festival migration apply

`admin_apply_legacy_festival_migration` implements the operation deferred by PR #1210.

## Flow

1. Run `admin_preview_legacy_festival_migration` for the legacy `game_events` festival.
2. Store and submit the preview hash.
3. Choose an existing canonical brand/edition or create them before apply.
4. Submit participant, stage, historical-only, and conflict-resolution choices.
5. Apply transactionally as a platform admin with a reason and idempotency key.

## Guarantees

The apply RPC rejects stale previews, preserves source metadata in `festival_legacy_mappings`, never invents contract economics, marks the source as read-only, records unresolved data in migration issues, and writes an admin audit event.

## Legacy write protection

Mapped festival `game_events` and their `festival_participants` rows are protected from new gameplay writes. Historical rows are retained and can be marked duplicate or historical-only by audited repair actions.
