# Festival production reconciliation — 22 August 2026

## Status

Production has been reconciled and functionally certified through the simplified owner flow:

**Plan → Line-up → Tickets & budget → Run Festival → Results**.

The production repair was applied as real 2026 Supabase migrations. The repository also contains a frozen inherited Festival migration chain dated in 2029. Those two histories cannot safely be collapsed into a single chronological replay without rewriting already-recorded migration IDs.

The simplified Results boundary closes the company loop: one completed Festival automatically posts its net profit/loss to the underlying company balance, applies the bounded reputation change, records one idempotent company transaction and preserves before/after values in the immutable result. The owner Results RPC exposes those private figures; the public history RPC deliberately does not.

A second functional-certification pass on 22 August found and repaired three owner-flow blockers that static schema checks had not exposed: annual Plan saves could not resolve pgcrypto, the same Plan RPC then failed because `city_id` was ambiguous, and artist invitation/offer responses used an older request-ledger terminal status rejected by the newer constraint. Festival upgrade/licence currency was also aligned with the Festival company's home-city currency instead of a hard-coded USD value.

## Why the 2026 migration files are history markers

Supabase compares migration history by the timestamp prefix. Production now records the 2026 versions listed in `scripts/supabase/festival-production-reconciliation.json`, so matching files must exist in `supabase/migrations` to avoid a remote-only history gap.

Those files intentionally contain no DDL on clean builds. Their production SQL repaired objects that the clean repository database does not create until the inherited 2029 sequence runs. Replaying the repair SQL at its real 2026 timestamps would therefore fail before its dependencies exist.

The base clean-build differences are applied after `supabase db reset` by:

`supabase/reconciliation/festival/20260822_simplified_festival_post_bootstrap.sql`

The company-settlement and owner-functional parity layers are then applied by the ordered reconciliation files recorded in `postBootstrapExtensions` in `scripts/supabase/festival-production-reconciliation.json`. The Festival database CI gate applies and certifies them through:

`supabase/tests/festival_simplified_production_overlay_regression.sql`

## Production reconciliation ledger

| Version | Name | Purpose |
| --- | --- | --- |
| 20260822092642 | reconcile_simplified_festival_planning_foundations | Annual-plan schema and projection foundations |
| 20260822092947 | reconcile_simplified_festival_annual_plan_api | High-level annual Plan RPC boundary |
| 20260822093314 | reconcile_simplified_festival_internal_projections | Automatic hidden site/stage/ticket/programme materialisation |
| 20260822093549 | reconcile_simplified_festival_projection_read_contracts | Edition projection reads expected by the owner UI |
| 20260822093811 | reconcile_simplified_festival_lineup_manager_actions | Edition-scoped candidate/invite/offer actions |
| 20260822094039 | reconcile_simplified_festival_runtime_foundations | Runtime/evidence/configuration foundations |
| 20260822094158 | reconcile_simplified_festival_run_api | One-click deterministic simplified Festival Run |
| 20260822094332 | fix_simplified_festival_runtime_pgcrypto_path | Qualify/resolve pgcrypto digest calls |
| 20260822095104 | reconcile_simplified_festival_automatic_results | Intermediate automatic-results attempt; superseded below |
| 20260822095200 | fix_simplified_festival_results_legacy_fk_boundary | Dedicated immutable Results table keyed to `festival_editions_v2` |
| 20260822102107 | harden_simplified_festival_results_trigger_privileges | Remove public execution of internal Results helpers |
| 20260822102248 | defer_simplified_festival_results_until_runtime_finalised | Freeze Results only after the whole Run transaction finishes |
| 20260822104919 | complete_simplified_festival_company_settlement | Automatically post Festival profit/loss and reputation to the company; add private owner Results and redact public financials |
| 20260822153456 | fix_festival_owner_pgcrypto_search_paths | Make owner Plan and artist idempotency helpers resolve pgcrypto |
| 20260822153540 | fix_festival_annual_plan_city_binding | Remove the ambiguous `city_id` binding that prevented annual Plan saves |
| 20260822153742 | restore_festival_artist_request_terminal_status_compatibility | Accept both active artist-flow terminal request statuses |
| 20260822154434 | align_festival_upgrade_currency_with_home_city | Use the Festival home-city currency for upgrades/licence money display |

## Important deployment rule

Do **not** run a blind production `supabase db push` while the inherited 2029 sequence remains present and absent from production history. `db push` compares local files against `supabase_migrations.schema_migrations` and will attempt missing migrations in timestamp order.

For Festival work until the repository-wide future-migration anomaly is retired:

1. normal PR CI must pass a full local `supabase db reset`;
2. the Festival post-bootstrap overlay and its ordered extensions must then pass;
3. production changes must be applied as forward current-date migrations;
4. every production-applied version must receive a matching history-marker file in the same PR or immediate reconciliation PR;
5. never use `migration repair` merely to silence a mismatch unless schema equivalence has been independently proven.

## Functional certification performed on production

Production was exercised using authenticated, rollback-only transactions so the real RPCs and state transitions ran without retaining test gameplay changes.

Certified paths:

- **Plan:** saving a licence-compatible one-day Local Festival succeeds, reaches `planningStatus = ready` and returns no annual-plan blockers.
- **Line-up:** owner invitation → artist response → owner offer → artist acceptance produces a confirmed booking and financial commitment.
- **Tickets & budget:** the edition ticket plan can be owner-confirmed and reaches `ready = true`.
- **Run Festival:** a fully prepared edition passes simplified run readiness and generates the automatic runtime/schedule, including NPC filler where needed.
- **Results & settlement:** completed runtime settlement creates the immutable result, attendance/outcome data, exact company balance movement equal to net profit/loss, and the bounded reputation effect.
- **Upgrades:** a valid purchase debits the exact authoritative cost, increments the owned level and company upgrade version.
- **Licence progression:** an eligible tier application debits the exact licence fee and promotes the active licence.
- **Currency:** Shock Festival resolves to GBP from its Portsmouth home city consistently for the upgrade/licence state as well as annual ticket/results flows.

Shock Festival's saved September plan was not altered by certification. Its current Medium/two-day draft remains legitimately blocked by the active Community Licence (2,500 attendance / one day) until the owner either reduces the annual plan or progresses the company licence.
