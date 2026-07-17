# Festival Admin UI Guide

Open `/admin/festivals` for festival administration. This is the only primary admin workspace for festivals; older festival admin routes redirect here.

The page flow is:

1. View the Festivals catalogue.
2. Select a festival.
3. Select an available festival edition, or allow the page to select the most relevant edition automatically.
4. Use Overview, Applications, Operations, Results, or Advanced.

Administrators should not paste database UUIDs. If a festival has no edition, the page shows `No edition has been created for this festival.` and a disabled `Create first edition` placeholder until Phase 1 restores creation.

Technical support tools such as legacy records, system checks, and audit logs are available from Advanced and are not required for normal festival management.

## Phase 1 hardening update

Festival creation now relies on server-projected reference data, server-authoritative edition numbering, authenticated actor idempotency, lifecycle/audit writes in the aggregate transaction, and explicit stage festival/edition consistency. Phase 1 is not considered fully verified unless frontend checks and the executable SQL harness pass in the target environment.
