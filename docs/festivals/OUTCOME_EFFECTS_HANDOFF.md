# Festival Outcome Effects Handoff

**Status: CLOSED by consolidated backlog PR B4.**

The canonical performance-resolution layer still writes immutable outcome proposals first. Settlement now consumes those proposals through one server-authoritative, replay-safe edition settlement rather than allowing the browser to apply money or career changes.

## Settlement authority

`settle_festival_edition(...)` prepares and applies one edition settlement. It uses the signed contract version, finalised performance outcomes, canonical attendance and canonical festival ledger rows, then completes only after reconciliation succeeds.

Career settlement applies bounded band fame, fan conversion, festival reputation, sponsor health and performer XP exactly once. Streaming uplift remains an auditable campaign record tied to its source effect.

Financial settlement posts artist payouts and applicable deposit refunds through the canonical Finance journal with stable idempotency keys. Guarantee, performance bonus, agreed `merch_share_percent`, organiser cancellation kill fees and band cancellation/no-show deposit returns are recorded in contract settlement instructions before money moves.

## Audit and read models

Every applied effect is linked back to the finalised performance outcome and settlement. Contract payments are linked to Finance transaction IDs and festival ledger entries.

- Players/band members use `get_festival_performance_settlement_breakdown(session_id)` for their detailed performance settlement.
- Festival organisers use `get_festival_edition_settlement_reconciliation(edition_id)` for edition-wide financial/career reconciliation.
- Raw settlement tables are no longer a general authenticated read surface; the narrow RPCs enforce the relevant band/organiser permissions.

## Remaining boundaries

Ticket-bonus settlement remains neutral until there is canonical per-band ticket-bonus evidence. Festival contract Finance settlement currently rejects non-USD editions rather than silently posting the wrong journal currency; broader multi-currency Finance support should remove that guard when available.
