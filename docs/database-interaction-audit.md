# Database interaction audit

## Issues fixed

- Replaced a `.single()` fetch in the personal loadout detail path with `.maybeSingle()` so an absent or RLS-hidden loadout no longer surfaces as a PostgREST 406/PGRST116 exception.
- Added required string validation before personal loadout, loadout item, pedal slot, sponsorship offer, contract, and band-scoped queries reach Supabase.
- Added database error wrapping that includes operation, table, filters, PostgREST code/details/hints, and an RLS-specific troubleshooting hint.
- Added explicit foreign-key context to loadout child inserts and sponsorship contract/payment inserts so FK failures identify the parent and child IDs involved.
- Stopped ignoring failures when accepting sponsorship offers and terminating contracts; follow-up status/payment updates now throw contextual errors instead of silently leaving partial state.
- Added status and numeric validation before accepting sponsorship offers, preventing invalid payment schedules from unsafe assumptions about `term_weeks` and `total_value`.

## Potential schema improvements

- Add or verify unique constraints that match `.maybeSingle()` assumptions, especially one active/pending sponsorship workflow row per relevant business key where the UI expects one row.
- Consider database constraints for positive sponsorship `term_weeks`, non-negative `total_value`, and valid status transitions.
- Consider `ON DELETE` behavior for loadout child tables and sponsorship payments so parent deletion/cleanup is predictable.
- Consider RPC wrappers for multi-step writes such as accepting a sponsorship offer so contract creation, payment creation, and offer status updates are atomic.

## Remaining risks

- This pass targeted high-risk client-side interactions found during review; many other `.single()` calls remain across hooks, pages, utilities, and Edge Functions and should be migrated when the row is optional.
- RLS cannot be fully proven from client code alone. A null result from `.maybeSingle()` can still mean either genuinely missing data or data hidden by RLS.
- Multi-step client workflows can still partially complete if later operations fail; schema redesign was avoided, so atomicity remains a risk until these flows move into database functions or Edge Functions.
- Embedded relationship selects assume Supabase can resolve the intended foreign keys. Ambiguous or missing FK relationships will still fail at runtime and should be covered by integration tests against the live schema.
