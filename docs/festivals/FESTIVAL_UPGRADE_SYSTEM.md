# Festival upgrade system

## Audit and decision

The repository previously contained a **design-only** licence list in `src/data/festivals.ts`, generic company upgrades, Festival setup constraints, and scattered capacity/quality calculations. It had no authoritative Festival upgrade ownership, pricing, upkeep, construction, effect, or snapshot catalogue. The legacy Festival records do not contain reliable eleven-category levels, so migration records preserve source values and default conservatively; balances, event size, and free-form amenities are never used to infer valuable ownership.

The canonical implementation is migration `20291218233000_canonical_festival_upgrades.sql`. It reuses `festival_companies`, the active-profile and company-authority helpers, and canonical `financial_accounts`, `financial_transactions`, double-entry ledger, and `finance_debit_owner`. Licence **ownership** is explicit and separate from calculated eligibility. All authoritative writes are RPC/worker-only; authenticated clients receive no table write grants.

## Catalogues v1 and v2 (Realignment 2A)

Catalogue v1 is the immutable historical five-level contract described below. Realignment 2A publishes catalogue v2 without updating or deleting any v1 level, purchase, effect snapshot, financial transaction, or locked edition snapshot. Existing mutable ownership moves from v1 level `n` to v2 level `n × 10`; owned and active levels are mapped independently, so construction retains its completion time and previously active benefit. The migration creates an explicit before/after audit event, creates no purchase operation, moves no money, and does not increment the company aggregate version. Unexpected ownership is recorded for review and publication fails rather than guessing.

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

Every v1 category has Basic through World Class (levels 1–5); absence is level 0. V1 uses the documented £5k/£15k/£40k/£100k/£250k base curve and £100/£300/£800/£2k/£5k weekly curve, stored in minor units with category multipliers. Construction preserves the prior active level.

Catalogue v2 has exactly 50 contiguous levels in each of the same eleven categories: Basic 1–10, Established 11–20, Professional 21–30, Major 31–40, and World Class 41–50. The server supplies band names and boundaries. Each historical tier cost and duration is deterministically divided across its ten new levels, including deterministic minor-unit remainder placement. Levels 10/20/30/40/50 exactly equal the corresponding v1 upkeep and effects, and every ten-level band's purchase sum equals its v1 tier price. Intermediate upkeep and effects increase monotonically; level 50 has exactly the old World Class power.

The resolver distinguishes owned, active, and effective levels. Four missed upkeep weeks reduce effective level by ten (bounded by active and zero), preserving the old one-tier penalty at milestones and defining the same band-sized penalty for intermediate and maximum levels. Weekly upkeep remains operational. The architecture's originally planned annual upgrade-cost conversion is deliberately deferred to Realignment 2B.

## Authority and integrations

`get_festival_upgrade_catalogue`, `get_festival_company_upgrades`, `get_festival_upgrade_purchase_preview`, and `get_festival_licence_progress` are the read boundary. State includes authoritative band/milestone metadata and a server-clock purchase-window projection. Preview reports all blockers, while purchase resolves the current valid licence and canonical company reputation itself. Licence eligibility thresholds formerly expressed as v1 levels 1–5 are stored as the equivalent v2 milestones 10–50; licence ranks themselves remain 1–5.

`purchase_festival_company_upgrade` takes a transaction advisory lock for the actor/idempotency key before reading its receipt, then locks the Festival Company aggregate. A same-payload replay returns the first result and a changed payload fails with `FESTIVAL_UPGRADE_IDEMPOTENCY_CONFLICT`. Under the company lock it counts only succeeded, financially backed purchase operations completed strictly later than `now() - interval '30 days'`. Catalogue v2 permits **20 company-wide granular level purchases per rolling 30 days**. This preserves the progression pace of the original five-level system after every historical milestone was split into ten smaller purchases; the previous 2-per-30-day limit unintentionally made the 50-level catalogue roughly ten times slower. Existing purchases remain in the rolling window and the exact 30-day boundary is excluded. Quota, authority, versions, one-level sequence, construction, delinquency, prerequisites, licence, reputation, and funds are checked before the canonical debit. Failures roll back the receipt, debit, ownership, snapshot, and audit together.

`activate_completed_festival_upgrades` and `process_festival_upgrade_upkeep` are service-only idempotent workers. Edition lock calls `snapshot_festival_edition_upgrades`; runtime and settlement consumers must use the immutable snapshot rather than mutable company ownership. The catalogue declares at least one planning, ticketing, runtime, or settlement consumer for every category. Licence tiers Local, Small, Medium, Large, and Major store explicit limits and upgrade requirements; eligibility never grants ownership.

## Legacy and outstanding work

No trustworthy legacy category level was discovered. `festival_upgrade_legacy_migrations` retains provenance, mapping version/quality, and review state for later production extraction without charging. Existing direct legacy Festival gameplay writers remain disabled and are not made safe by this change. Admin catalogue authoring beyond the immutable database contract and deeper visual tooling remain follow-up work.

## Consumer and snapshot compatibility

Planning, ticketing, runtime, and settlement continue consuming the same bounded effect keys declared by each category. They do not gain a new maximum. Existing edition snapshots retain their v1 catalogue version and resolved effects; edition lock continues to snapshot immutable evidence and all future locks resolve the sole published v2 catalogue. Timetable rules, runtime rewards, and settlement formulae are unchanged.

## Certification status

The source/type coverage test is executable locally. The SQL harness requires a reset disposable Supabase database and must pass before this subsystem is called certified. Until that run, database execution, concurrent sessions, upkeep recovery, and edition snapshot integration remain **implemented but uncertified**.
