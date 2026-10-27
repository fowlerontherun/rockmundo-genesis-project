# City Scene Challenges

A community progression feature using daily, weekly and monthly verified city objectives, recognisable poster artwork, shared social goals and progression rewards.

## Design documents
- [Feature specification](01_FEATURE_SPEC.md)
- [UI/UX screen breakdown](02_UI_UX_SCREEN_BREAKDOWN.md)
- [Phased implementation plan](03_PHASED_IMPLEMENTATION_PLAN.md)
- [Phase 0 source audit and delivery status](SOURCE_AUDIT.md)
- [Processor rollout and dry-run runbook](PROCESSOR_RUNBOOK.md)
- [Live schema deployment record — 27 Oct 2026](LIVE_SCHEMA_DEPLOYMENT_20261027.md)
- [Live four-city pilot, scoring and scheduler — 27 Oct 2026](LIVE_PILOT_20261027.md)

## Implementation status — live daily/weekly pilot

**27 October 2026:** The City Scene schema and follow-on verification/rollout migrations are deployed directly to RockMundo main Supabase. The current pilot includes **4 recently active cities**, **8 active cycles** (4 daily, 4 weekly), **24 objectives**, and verified gig, studio recording and band rehearsal scoring. The monthly mural campaign starts on **1 November 2026**, when a full calendar month is available.

A named, service-only database job (`rockmundo-city-scene-verified-v1`, job #157) runs every 15 minutes. Its first observed scheduled execution at 13:00 UTC **succeeded**. The first source pass credited **3 verified gig contributions**; rehearsal and recording source queues are operational but had no qualifying events inside the active weekly window. Two community mural milestones were recorded. The Edge Function is deployed as version 2 with a separate authentication/enable gate.

**Reward safety:** All four XP policies and the payout switch are **OFF**. No City Scene XP receipts or reward claims were created. Social invitations and unverified jam attendance never score; account/day city affiliation, event deduplication and per-account cycle caps are enforced in PostgreSQL.

For rollout configuration, verified counts, scheduler monitoring and the emergency disable command, see [LIVE_PILOT_20261027.md](LIVE_PILOT_20261027.md). Periodic processing can be halted by setting both `scene_rollout_controls` switches to `false`; the named cron can also be unscheduled. Full reward balance/issuance remains a later gated phase.
