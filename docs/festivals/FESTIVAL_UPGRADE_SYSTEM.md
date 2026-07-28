# Festival upgrade system

## Audit and decision

The repository previously contained a **design-only** licence list in `src/data/festivals.ts`, generic company upgrades, Festival setup constraints, and scattered capacity/quality calculations. It had no authoritative Festival upgrade ownership, pricing, upkeep, construction, effect, or snapshot catalogue. The legacy Festival records do not contain reliable eleven-category levels, so migration records preserve source values and default conservatively; balances, event size, and free-form amenities are never used to infer valuable ownership.

The canonical implementation is migration `20291218233000_canonical_festival_upgrades.sql`. It reuses `festival_companies`, the active-profile and company-authority helpers, and canonical `financial_accounts`, `financial_transactions`, double-entry ledger, and `finance_debit_owner`. Licence **ownership** is explicit and separate from calculated eligibility. All authoritative writes are RPC/worker-only; authenticated clients receive no table write grants.

## Catalogue v1

Stable keys are never renamed. Published versions and their levels are immutable; balancing requires a new draft/version.

1. `site_infrastructure` — makes site capacity, resilience, planning, and ticket limits progressive.
2. `stages_production` — bounds stages/acts and influences production runtime quality.
3. `security_crowd_control` — supplies enforceable crowd safety and incident mitigation.
4. `medical_welfare` — supplies enforceable medical readiness and incident mitigation.
5. `sanitation_utilities` — controls utilities reliability and settlement costs.
6. `artist_backstage` — affects artist readiness, attraction, and cancellation risk.
7. `audience_facilities` — affects VIP capacity, queues, satisfaction, and ancillary revenue.
8. `camping_accommodation` — enables camping planning/products and accommodation revenue.
9. `transport_access` — constrains practical attendance and arrival reliability.
10. `marketing_media` — affects demand, fame, sponsors, and media reach.
11. `sustainability_technology` — affects waste/energy costs, cashless operation, detection, and reputation.

Every category has Basic through World Class (levels 1–5); absence is level 0. V1 uses the documented £5k/£15k/£40k/£100k/£250k base curve and £100/£300/£800/£2k/£5k weekly curve, stored in minor units with category multipliers. Construction preserves the prior active level. The resolver distinguishes owned, active, and effective levels; missed upkeep applies penalties without destroying ownership.

## Authority and integrations

`get_festival_upgrade_catalogue`, `get_festival_company_upgrades`, `get_festival_upgrade_purchase_preview`, and `get_festival_licence_progress` are the read boundary. `purchase_festival_company_upgrade` locks the company aggregate, checks expected versions/sequence/authority/prerequisites/delinquency, performs one canonical ledger debit, snapshots effects, audits, and persists an idempotent result in one transaction. Stable `FESTIVAL_UPGRADE_*` codes are mapped by the UI.

`activate_completed_festival_upgrades` and `process_festival_upgrade_upkeep` are service-only idempotent workers. Edition lock calls `snapshot_festival_edition_upgrades`; runtime and settlement consumers must use the immutable snapshot rather than mutable company ownership. The catalogue declares at least one planning, ticketing, runtime, or settlement consumer for every category. Licence tiers Local, Small, Medium, Large, and Major store explicit limits and upgrade requirements; eligibility never grants ownership.

## Legacy and outstanding work

No trustworthy legacy category level was discovered. `festival_upgrade_legacy_migrations` retains provenance, mapping version/quality, and review state for later production extraction without charging. Existing direct legacy Festival gameplay writers remain disabled and are not made safe by this change. Admin catalogue authoring beyond the immutable database contract and deeper visual tooling remain follow-up work.

## Certification status

The source/type coverage test is executable locally. The SQL harness requires a reset disposable Supabase database and must pass before this subsystem is called certified. Until that run, database execution, concurrent sessions, upkeep recovery, and edition snapshot integration remain **implemented but uncertified**.
