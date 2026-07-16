# Festival troubleshooting

## Support error codes

- `FESTIVAL_EDITION_OPTIONS`: owner edition options failed to load. Check `festival_owner_edition_options`, RLS, and the authenticated profile.
- `FESTIVAL_INVALID_EDITION_ROUTE`: the route edition is not authorised, not part of the brand in the URL, or unresolved by migration.
- `FESTIVAL_RESPONSE_INVALID`: a festival RPC returned a shape the frontend does not understand.
- `FESTIVAL_MIGRATION_REQUIRED`: a legacy ID-domain, mixed-currency, or unresolved operational mapping issue blocks safe management.
- `FESTIVAL_PERMISSION_DENIED`: RLS or an authority check denied the action.

## Common repairs

1. Open the admin migration-health view or query `festival_operation_migration_issues`.
2. Resolve only deterministic issues: assign edition, mark historical-only, mark duplicate, or ignore with a reason.
3. Do not repair by updating arbitrary SQL from the UI.
4. Re-run `supabase db reset` and `supabase/tests/festival_stabilisation_harness.sql` after migration changes.

## Data integrity checks

- Ledger rows must use the edition currency; unknown historical currency must be a migration blocker, not USD.
- Staff, permit, and insurance rows must not be attached to edition #1 unless the brand has exactly one edition or another deterministic signal exists.
- Stages with ambiguous `festival_id` domains must be resolved through `resolve_festival_stage_legacy_domain()`.
- Slots must match their stage edition, sit inside edition dates, and not overlap active slots on the same stage.
