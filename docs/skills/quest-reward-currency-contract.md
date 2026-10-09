# Quest rewards versus random-event skill XP

Verified against live Supabase on 2026-10-09.

## Distinct currencies

**Starter skill quests**: Existing GitHub `skill_quest_reward_definitions` entries use `reward_kind='xp'` and fixed amounts (500, 400, 400, 500). Treat as **general character XP**. The corresponding processor must credit the general XP wallet and ledger exactly once, and keep definitions disabled until end-to-end tested.

**Comical random daily events**: The live `grant_random_event_skill_xp(uuid)` function selects an eligible `skill_progress` row with level >=1 and below the skill cap, adds 100–500 skill XP, handles level rollover, and writes `random_event_skill_xp_grants`. This is **skill-specific progression**, not general wallet XP. It locks the event row and checks existing grant records to make retries idempotent.

Do **not** call `grant_random_event_skill_xp` to fulfil a generic quest claim: it requires a real random-event row and would change the award semantics. Do **not** use `increment_profile_xp` alone for general quest XP: it only updates `profiles.experience`, not wallet lifetime XP.

## Release criteria

- Integrate general XP with the **actual** live wallet and authoritative ledger semantics; inspect other existing general XP grant functions first.
- Verify claim/source/definition matching, service-only permissions, atomic wallet+ledger+claim transaction, replay and concurrency.
- Stage-test wallet delta and profile-level recalculation.
- Keep all quest reward definitions disabled until explicitly approved.
- Never retrofit random event grant records as quest grant evidence.

This document is an implementation contract only; no live data or schema was changed.
