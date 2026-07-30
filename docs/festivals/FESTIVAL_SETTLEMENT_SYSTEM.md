# Authoritative Festival edition settlement

## Authority and aggregate

`festival_edition_settlements` is the only settlement authority for canonical annual editions. It has one non-voided row per edition and binds the Festival company, edition, canonical runtime, runtime completion digest, published schedule revision, upgrade snapshot and licence snapshot. The pre-existing `festival_financial_settlements` system is classified as `legacy_rpc`/`compatibility_read` and must not accept canonical `festival_editions_v2` runtimes.

Money is an integer number of minor units and every aggregate and line carries one ISO currency. UI formatting is `en-GB`. Revenue and cost lines preserve source identity, frozen evidence, tax treatment, calculation rule and rules version. Unexplained totals and mutable company configuration are not inputs.

## State machine

`pending -> preparing -> review -> approved -> posting -> completed` is the normal path. Posting may enter `recovery_required`, from which the same posting batch continues. `failed` and `voided` are terminal operational states. `completed -> reopened -> review` is reserved for a future platform-admin correction RPC: the active implementation deliberately exposes no owner reopen command. A replacement must increment the settlement version and retain the original history snapshot.

## Inputs and reconciliation

Preparation copies the completion digest, versioned runtime configuration, append-only runtime evidence, incidents, ticket snapshot, contracts, tax jurisdiction, refunds and approved financial evidence into `input_snapshot`. Missing digest, ticket or tax evidence fails closed. Revenue, costs, refund and jurisdictional tax lines are reconciled to the persisted aggregate. `blocked` reconciliation cannot be approved or posted.

Supported category vocabulary is the task catalogue: ticket types; food/drink, merchandise, vendor, sponsor, broadcast/media, parking/transport/accommodation, grants and approved income; and artist, staff, supplier, production, safety, services, marketing, insurance, licence/land, inventory, waste, tax, refunds, incidents, emergency procurement, sponsor penalties, processing and approved costs. Contract-derived frozen evidence distinguishes real recipients from NPC cost-only lines.

## Posting and recovery

`post_festival_edition_settlement` locks and version-checks the aggregate, checks approval/digest/reconciliation, and delegates every movement to the shared `financial_transactions`/`financial_ledger_entries` finance authority. Stable per-line posting references are unique. A batch records each company receipt, payable, tax, refund and expense. Retry skips posted items; it never deletes ledger evidence. Request hashes make prepare, approve and post idempotent, while changed payloads with the same key return `FESTIVAL_SETTLEMENT_IDEMPOTENCY_CONFLICT`.

Accounting profit and cash movement are separate fields. Sponsor receivables and unpaid payables are never displayed as cash. Player artists/staff/player-owned suppliers use their canonical ledger account; NPC obligations remain explicit costs without player notifications.

## Outcomes

Completion creates evidence-linked, versioned outcome rows, licence eligibility evidence and stable achievement evidence. Satisfaction, reputation, fans/fame and participant rewards must be derived from runtime/performance evidence and applied once through their shared services. Settlement never replays rewards owned by the performance engine. Current implementation certifies audience satisfaction and evidence hand-off; per-artist/sponsor components and shared fame/reward worker integration remain **uncertified**.

## Security and stable errors

Tables have RLS enabled and direct `anon`/`authenticated` writes revoked. Definer RPCs resolve `auth.uid()` through the active profile, verify the company/edition relationship and never accept an actor ID. Public access is restricted to a redacted history projection. Stable errors use the `FESTIVAL_SETTLEMENT_*` namespace; raw PostgreSQL messages are mapped by the repository UI.

## Legacy migration

Legacy results remain read-only. Migration may copy known totals, attendance and dates with provenance, but must mark inferred values and must not fabricate line detail or modern ledger movements. Ambiguous records remain compatibility reads.
