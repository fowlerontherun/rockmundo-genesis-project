# Festival B6 Commerce and Analytics Closure

**Status:** COMPLETE  
**Backlog item:** PR B6 — Festival ticket tiers, vendors and operational analytics closure

## Canonical authority

B6 closes the remaining organiser-facing commerce gaps without introducing a second ticket, vendor or settlement engine.

- Ticket products and `festival_ticket_inventory` remain the admission inventory authority.
- `purchase_festival_tickets` remains the only player purchase mutation and retains its row lock / sold-out check.
- `festival_runtime_vendor_sales` remains the runtime sales evidence authority.
- Phase 9 `festival_financial_settlements` / `festival_settlement_lines` remain the festival payable authority.
- `financial_transactions` remains the money-movement authority.
- B5 `festival_editions` are linked to launch/runtime commerce only through an explicit, unambiguous bridge. Missing or ambiguous mappings fail closed.

## Ticket tiers and dynamic pricing

Existing public ticket products are the ticket tiers. B6 adds a stable `base_price_minor`, a pricing version, versioned dynamic-pricing rules, and immutable price-history rows.

Effective prices are recalculated inside the database from canonical sell-through before a new purchase reads the ticket product. The browser supplies a product, quantity and idempotency key; it never supplies the checkout price.

The existing purchase flow still locks the ticket inventory row and rejects quantities above `available_quantity`, so dynamic pricing does not weaken oversell prevention.

## Vendor stalls and settlement

Organisers can configure external food, soft-drink, permitted bar and festival-merch stalls with:

- canonical player, band or company payee;
- gross or gross-after-tax share basis;
- revenue-share basis points;
- optimistic version and idempotency controls.

Open runtime vendor sales can be assigned to a compatible configured stall. Closed sales cannot be retroactively assigned.

When an assigned sale closes, B6 snapshots the agreed stall terms and sale totals into one vendor settlement obligation. When Phase 9 settlement is prepared, that obligation becomes an `other_expense` settlement line. The existing settlement processor then uses `finance_transfer` and its stable settlement-line idempotency key. Payment state and Finance transaction ID are reflected back onto the vendor obligation.

Unassigned runtime sales remain festival-operated and do not fabricate an external vendor payable.

## Organiser analytics and reconciliation

The organiser outcomes workspace now exposes:

- ticket capacity, sold, remaining and sell-through;
- ticket base/current tier pricing and active pricing rules;
- gross ticket cash, refunds and Finance-posted ticket receipts;
- vendor gross sales, tax, cost basis and revenue postings;
- configured vendor stalls and live runtime sale assignment;
- vendor share payable, paid and outstanding amounts;
- unique attendees, admissions and peak onsite attendance;
- average crowd satisfaction;
- completed performances, average performance score and peak audience;
- Phase 9 settlement status and financial totals.

Reconciliation is fail-visible. The projection reports explicit codes for ticket/Finance mismatches, vendor sale/posting mismatches, missing vendor settlement lines, and vendor shares still outstanding after a supposedly completed settlement.

## Security and retry behaviour

New B6 tables have RLS enabled and no broad `anon`/`authenticated` table grants. Player/organiser access is through narrow permission-checked RPCs. Internal `SECURITY DEFINER` helpers pin an empty `search_path`, are schema-qualified and have public execution revoked.

Pricing and vendor configuration commands use actor/action/idempotency request rows plus optimistic versions. Runtime sale assignment is also version checked. Finance execution remains protected by the existing Phase 9 settlement idempotency keys.

## Verification coverage

`commerceB6.database.test.ts` guards:

- inventory row locking and sold-out rejection;
- server-owned price calculation and repricing triggers;
- command idempotency and stale-version rejection;
- close-time vendor share snapshotting;
- Phase 9 / Finance payout integration;
- edition bridge fail-closed behaviour;
- analytics/reconciliation evidence;
- organiser UI use of narrow RPCs;
- RLS, grants and internal-function privilege boundaries;
- the repository's frozen festival migration ordering exception.
