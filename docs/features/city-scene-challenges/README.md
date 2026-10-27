# City Scene Challenges

A community progression feature using daily, weekly and monthly verified city objectives, recognisable poster artwork, shared social goals and progression rewards.

## Design documents
- [Feature specification](01_FEATURE_SPEC.md)
- [UI/UX screen breakdown](02_UI_UX_SCREEN_BREAKDOWN.md)
- [Phased implementation plan](03_PHASED_IMPLEMENTATION_PLAN.md)
- [Phase 0 source audit and delivery status](SOURCE_AUDIT.md)
- [Processor rollout and dry-run runbook](PROCESSOR_RUNBOOK.md)

## Implementation status
The draft PR now includes a City Scene Board route linked from each city, authenticated personal totals, protected schema and read RPCs, an independently verified jam adapter, server-only cycle/milestone reconciliation, and a dry-run-first processor Edge Function. The live database has **not** been migrated; source templates and the processor remain disabled by default. No actual XP/fame/cash payout implementation is enabled. Review the processor runbook before applying any migration.

**Implementation safety:** never award for client clicks/bookings/invitations; enforce server-finalised source events, account-per-day city affiliation, idempotent grant receipts and privacy-safe public aggregates.
