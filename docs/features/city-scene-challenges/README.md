# City Scene Challenges

A community progression feature using daily, weekly and monthly verified city objectives, recognisable poster artwork, shared social goals and progression rewards.

## Design documents
- [Feature specification](01_FEATURE_SPEC.md)
- [UI/UX screen breakdown](02_UI_UX_SCREEN_BREAKDOWN.md)
- [Phased implementation plan](03_PHASED_IMPLEMENTATION_PLAN.md)
- [Phase 0 source audit and delivery status](SOURCE_AUDIT.md)
- [Processor rollout and dry-run runbook](PROCESSOR_RUNBOOK.md)
- [Live schema deployment record — 27 Oct 2026](LIVE_SCHEMA_DEPLOYMENT_20261027.md)

## Implementation status — live database schema deployed

**27 October 2026:** All **19 City Scene migration files** committed to GitHub `main` were applied directly to the main RockMundo Supabase project (`eu-west-2`) and their migration-history versions were reconciled to the canonical repository filenames. Post-deployment RLS/grants smoke tests passed. Fourteen City Scene tables exist with RLS; seven templates and four XP reward policies are **disabled**, the payout switch is **false**, and no cycles, contributions, claims or reward receipts have been created.

The City Scene board, verified jam/recording/gig adapters, atomic queue cursors, scene target balancing (3/6/12 points per active account per daily/weekly/monthly period), completed-mural milestones, personal progress and XP reward infrastructure are present in the database. **The feature is not yet playable or issuing XP in production** because sources, recurring processor and payouts are not activated. The `scene-challenges-processor` Edge Function has since been deployed (version 1), but remains explicitly guarded by its dedicated secret and enable flag; no processing schedule was created.

**Implementation safety:** never award for client clicks/bookings/invitations; enforce server-finalised source events, account-per-day city affiliation, idempotent grant receipts and privacy-safe public aggregates. Operator approval of source health, scheduled processing and economy balancing is still required before enabling them.
