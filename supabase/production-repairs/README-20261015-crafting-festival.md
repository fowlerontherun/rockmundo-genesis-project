# Production database reconciliation — crafting and festival lineup

Applied directly to `yztogmdixmchsmimtent` on 15 October 2026. The three SQL files archived next to this document are exact live `supabase_migrations.schema_migrations.statements[1]` contents. They belong in `supabase/production-repairs/`, **not** the normal migration queue. Do not replay via blanket `supabase db push`.

| Live version | Migration | SQL archive |
| --- | --- | --- |
| `20261015160344` | `rockmundo_20261015_crafting_raw_inventory_write_lock` | `20261015160344_crafting_raw_inventory_write_lock.sql` |
| `20261015160409` | `rockmundo_20261015_festival_lineup_view_rls_invoker` | `20261015160409_festival_lineup_view_rls_invoker.sql` |
| `20261015160702` | `rockmundo_20261015_atomic_legacy_crafting_live_compat` | `20261015160702_atomic_legacy_crafting_live_compat.sql` |

## Applied changes

1. Lock legacy crafting `crafting_blueprints`, `crafting_sessions`, `player_crafting_materials` against client-side INSERT/UPDATE/DELETE; retain RLS owner-scoped SELECT. Existing `grant_starter_crafting_blueprints` and `create_custom_luthiery_instrument` remain SECURITY DEFINER and are not modified.
2. Change `public_festival_lineup` to `security_invoker=true` and remove direct view DML grants. Direct view access now obeys `festival_contracts` RLS. Public-safe `public_festival_lineup_read(uuid)` is still available and was successfully called as `anon` in a rollback-only verification. Security advisor `security_definer_view` error cleared.
3. Install four live-compatible crafting RPCs: `purchase_crafting_material_atomic`, `start_crafting_session_atomic`, `collect_crafting_session_atomic`, `salvage_equipment_atomic`. The original October migration cannot be replayed: live recipes store `qty` (not `quantity`), and `gear_categories`/`equipment_items.gear_category_id` do not exist. Payment uses `bigint` arithmetic and ownership row lock; material inventory, session creation, unique outcome, idempotent retry and salvage are transactional; only authenticated player EXECUTE is granted.

## Verification

- Live rollback-only test covered material purchasing, starting the actual recipe with temporarily unlocked test skill, refusal of early collection, successful single collection, repeat/once-only collection, salvage, denial of duplicate salvage and exact cash debit. All test writes were rolled back. Follow-up counts: 0 `crafting_sessions`, 0 `player_equipment` (unchanged), 912 blueprints. No historical crafting payouts or stock adjustments.
- All four RPCs are callable by `authenticated`, not `anon`.
- Live migration history advanced to 1,457.
- New `security_invoker` flag confirmed; security advisor no longer reports the festival view error. Other pre-existing warning families remain.

## Remaining risks / follow-ups

- Browser live end-to-end test still needed. At verification time no live active character had `skill_progress.current_level` meeting a blueprint's recipe requirement; the test used a temporary skill change rolled back afterward. Legitimate skill unlocking needs separate checking.
- Do not automatically apply old crafting SQL or restore raw client-write grants.
- Payroll, sponsorship, pending disabled skill-quest rewards, and Edge Function rollouts remain separate gated tasks.
