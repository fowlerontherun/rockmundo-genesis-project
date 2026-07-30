# Festival settlement progression authority audit

Festival settlement is an orchestrator. It owns deterministic evidence, effect state, and stable references; it does **not** own progression balances.

| Effect | Canonical authority / evidence | Festival policy |
|---|---|---|
| Performance score, fans, fame, member XP, fatigue, injury and song effects | `gig_outcomes` and the `auto-complete-gigs` / gig post-processing pipeline | Consume the immutable gig result. Never recompute or write its progression tables. Only attending members and performed setlist items may appear. |
| Band chemistry | band contribution events followed by `recalculate_band_chemistry(uuid)` | Reuse the gig-completed contribution reference; do not add chemistry directly. |
| Achievements | stable `achievements` definitions and canonical `player_achievements` award rows (whose trigger awards unlock XP) | Resolve an existing definition and recipient; store the returned award id. Evidence alone is not an award. |
| Festival company reputation / fame | company reputation service (no safe Festival adapter currently exists) | Required effect fails with `FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING` until an adapter is deployed; never update a reputation column here. |
| Artist and sponsor relationships | canonical relationship/sponsorship contract services | Verify `festival_contracts.band_id` or the accepted sponsor contract before applying a bounded delta. |
| Licence | canonical Festival licence/application projection | Store the canonical projection id and result, rather than an isolated evidence document. |
| World Pulse/news | `world_events` writer | Public, evidence-only payload and stable event reference; settlement financial details are excluded. |
| Notifications | `create_notification` / typed `notifications` authority | Use a typed route and stable reference; recipients are resolved server-side. |
| Finance and tax | finance RPCs and `financial_transactions` | Tax lines reconcile to `tax_minor`; payment transaction identifiers are canonical finance identifiers. |

## Shared gig decision

A Festival performance session must be adapted into the existing gig completion pipeline, or consume an already-completed immutable `gig_outcomes` projection. Settlement must use `festival-performance:{sessionId}:{effectType}:{subjectId}` as the authority idempotency key. If the projection already records that key, settlement classifies the effect as applied using that canonical result; it never awards it again. NPC sessions provide public performance evidence but player XP, player achievements, and player finance effects are `not_applicable`.

## Lifecycle

Calculation reads the locked runtime/settlement snapshots, records every component's source/raw/normalised/weight/contribution/missing handling/rules version, and creates `pending` effects. A bounded worker claims one row with a lease. Only a canonical authority response can acknowledge `applied`; failures preserve earlier results. Outcome `applied_at` is derived only after all its effects are `applied` or `not_applicable`. Final history must project `applied_result` and canonical identifiers, never requested payloads.
