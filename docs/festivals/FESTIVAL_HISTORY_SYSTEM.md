# Immutable Festival edition history

A completed canonical settlement freezes exactly one snapshot per settlement version in `festival_edition_history_snapshots`. The private snapshot contains the frozen settlement inputs, detailed lines and evidence-derived outcomes; its runtime and settlement digests make provenance verifiable. A database trigger rejects update and delete with `FESTIVAL_SETTLEMENT_HISTORY_ALREADY_FROZEN`.

The separate `public_projection` is the only anonymous read surface. It contains dates, attendance, audience rating, sell-out state and a broad profitability band. It intentionally excludes exact financial values, contract terms, staff identities, individual medical data, security weaknesses and private sponsor penalties. The public page reads this projection rather than joining current Festival-company data.

A future admin correction creates a new settlement version and snapshot, preserving the original. Rebalancing rankings or awards must create a versioned projection/evidence record and never mutate a historical snapshot. Legacy history can be imported read-only with `migration_provenance`; unknown detail must remain unknown.
