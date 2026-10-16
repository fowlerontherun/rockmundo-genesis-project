# 9–16 October 2026 migration reconciliation: business write access follow-up

Production project: `yztogmdixmchsmimtent`.

## Inventory and matching

- Enumerated 134 migration SQL files with date prefixes 20261009–20261016 in `supabase/migrations`.
- 95 have a production migration-name match, allowing for Supabase's actual application-time timestamp or an embedded source timestamp.
- 39 do not have a matching source filename in the production history and require effect-level classification; **these are not 39 missing migrations**.
- Production count after security fix: **1,498 recorded migrations**, including `20261016204225`.

## Findings verified directly in production

- Previous PR #4180 (subsidiary staffing) is merged.
- Catalogue-backed recording/rehearsal equipment purchase RPCs and the private request ledger are installed; the underlying `equipment_catalog` has 565 entries, owner purchase RPC enforces catalogue selection, pricing, availability and stock decrement. Original `20261012230500_atomic_subsidiary_purchases.sql` is superseded.
- `daily-book-reading-attendance` cron is active, scheduled `0 23 * * *`, and obtains its `x-cron-secret` from Vault at runtime. Original `20261010180500_secure_book_reading_cron.sql` should not be re-applied.
- `skip_and_complete_songwriting_project` non-instrument overload is intentionally obsolete: live frontend calls `skip_and_complete_songwriting_project_with_instruments`; `20261012230900_atomic_songwriting_skip_completion.sql` should not be applied.
- `20261013184000_achievement_event_reward_integrity.sql` still has missing predecessor schema dependencies and must not be applied blindly.
- `20261012213100_atomic_sponsorship_installments.sql` is blocked until earnings-trigger / band ledger reconciliation can be staged and safely verified.

## New critical privilege gap fixed on production

Prior to this pass, authenticated users with owner-scoped RLS access could still submit INSERT/UPDATE operations against business asset tables directly rather than through debit-backed RPCs. RLS ownership checks alone do not enforce payment or server-priced stats.

**Applied:** `20261016204225_rockmundo_block_direct_business_asset_inserts_updates_20261016`.

- REVOKE INSERT/UPDATE on 14 purchase-backed tables (logistics drivers, fleet, upgrades; merch workers; security guards/upgrades; venue staff/upgrades; recording/rehearsal staff, equipment and upgrades) from PUBLIC, anon and authenticated.
- Keep SELECT and DELETE permissions unchanged to avoid breaking existing reads and staff-release flows.
- Verified all 14 tables deny authenticated INSERT/UPDATE after migration while `service_role` retains privileges, and SECURITY DEFINER purchase RPCs remain owned by `postgres`.
- For `label_staff`, revoked UPDATE only. Its direct INSERT must remain until the older `LabelStaffTab` is deployed with RPC-based hiring.

## Pending safe cutover

- PR source change to `LabelStaffTab` replaces direct balance decrement, client-inserted staff, rollback/refund races and client transaction recording with `hire_label_staff_atomic`, using stable UUID + name per attempt and a company balance read for display.
- Once merged and **deployed to clients**, manually apply `supabase/production-repairs/20261016_label_staff_insert_cutover_AFTER_UI_DEPLOY_MANUAL_ONLY.sql` to revoke `label_staff` INSERT. Applying early would break the old UI.
- Do not replay any archive under `production-repairs` automatically. Reconcile by live effects and current schema, not filename alone.
- Still require signed-in staging tests proving successful charge, idempotent retry, staff hire/firing and business purchase UI compatibility. Existing permissions-only checks do not substitute for them.

## Further migration groups to classify

- Five gig skill-quest ingestion/claim files: past reviews kept reward claims disabled until credible XP source and ledger evidence exist.
- October 12–13 originals for lottery, crafting, audio, underworld, social visibility and messaging have several later production-specific replacements; compare individual effects, not file timestamps.
- Halloween Oct 16 original files were installed in staged/disabled forms on purpose; preserve staged status until visual QA and launch preflight.
- Remaining unmatched files with insufficient evidence: preserve as **needs individual reconciliation**, not safe-to-replay.
