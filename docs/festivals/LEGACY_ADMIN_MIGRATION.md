# Legacy festival admin migration

Legacy `game_events` festival records and `festival_participants` are retained for history but are no longer authoritative for new administration.

## Read-only policy

The canonical admin page no longer creates, edits or deletes festival `game_events`. Legacy records appear through compatibility mappings in `festival_legacy_mappings` and data-health warnings from `admin_festival_catalogue()`.

## Migration workflow

1. Preview with `admin_preview_legacy_festival_migration(p_game_event_id)`.
2. Review proposed brand, edition, participants, finance and conflicts.
3. Apply through a future audited apply RPC when unmappable economics are understood.
4. Mark the source read-only and preserve metadata.

The preview RPC is side-effect free and reports `mutates_data: false`.
