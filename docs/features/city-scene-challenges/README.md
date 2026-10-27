# City Scene Challenges

A community progression feature using daily, weekly and monthly verified city objectives, recognisable poster artwork, shared social goals and progression rewards.

## Design documents
- [Feature specification](01_FEATURE_SPEC.md)
- [UI/UX screen breakdown](02_UI_UX_SCREEN_BREAKDOWN.md)
- [Phased implementation plan](03_PHASED_IMPLEMENTATION_PLAN.md)
- [Phase 0 source audit and delivery status](SOURCE_AUDIT.md)

## Implementation status
A fail-closed schema and reusable UTC-scoring/visual foundations are staged on the feature PR. No cycles, verified contributions, payouts or live UI are enabled yet. Review the phase plan and source audit before applying the migration.

**Implementation safety:** never award for client clicks/bookings/invitations; enforce server-finalised source events, account-per-day city affiliation, idempotent grant receipts and privacy-safe public aggregates.
