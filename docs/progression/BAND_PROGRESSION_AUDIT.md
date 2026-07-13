# Band Progression Audit

## Current band-role handling

Band membership is stored in `band_members` and most UI flows read `role` and `instrument_role` directly. Roster, performance, release, festival, setlist and dashboard components query this table independently, so role display is available but not consistently tied to canonical skill readiness. Previous social implementation docs confirm invite, application and contribution flows use active `band_members` relationships and leader/founder style roles for authorization.

## Current role-gap calculations

The coherent canonical readiness model is character-level: `CANONICAL_ROLE_LINKS` maps skills to roles, and `summarizeRoleReadiness` turns visible skill progress into role readiness. Band-level gaps were not a single server-authoritative workflow before this PR. Existing gig and recording flows infer readiness from their own preparation data, setlists, familiarity and crew/equipment choices rather than a shared band coverage service.

## Current shared progression features

The repository has individual skill progression, teaching/mentoring, rehearsal familiarity, gig preparation, recording preparation, songwriting collaboration and contribution feeds. It did not have durable shared band progression goals, goal requirements, member contribution tasks or coordinated training plans.

## Current rehearsal rewards

Rehearsal components update `band_song_familiarity` and related rehearsal records. Rewards are activity/familiarity oriented. There was no goal-aware reward ledger that checks distinct participants, source-event uniqueness or synergy caps.

## Current cohesion rewards

Band contribution events and relationship/cohesion systems exist, but no shared progression milestone reward model connected role-gap closure, onboarding or training plans to bounded cohesion/reputation outcomes.

## Current member permissions

Existing band workflows use accepted active membership and leader/founder/co-leader/manager style roles for elevated actions. Permission logic is distributed across client components and database RPC/policies from prior social PRs. This creates a risk that new goal features would accidentally rely on client-only checks unless RLS and server-side completion are added.

## Current gig and recording preparation workflows

Gig preparation has dedicated readiness documentation and tables for crew, equipment, costs and readiness previews. Recording flows use song familiarity, session configuration and production-session data. These systems should remain canonical; band goals should reference their preview outputs rather than copy formulas.

## Current band activity feed

`bandContributions` and prior social docs describe immutable contribution events with active-member read access. Existing feeds are appropriate for meaningful progression events, but exact private skill or attribute values should not be logged.

## Current onboarding for new members

Invitations and applications can add members safely, but there is no progression onboarding workflow that suggests a provisional role, starter lesson, setlist familiarity target, first rehearsal and first contribution while preserving autonomy.

## Duplicate or conflicting role logic

Role logic appears in canonical skill mappings, gear performance helpers, rehearsal efficiency helpers, member UI labels and gig/recording preparation screens. The main conflict is label-first role inference versus canonical role-to-skill readiness. Band progression should use canonical mappings and only treat selected role labels as context.

## Known bugs and workflow gaps

- No single band-level gap dashboard exists.
- No historical completed/abandoned goal snapshots exist.
- No idempotent band progression reward ledger exists.
- No structured blocked reason model exists for cancelled source activities, departed members or prerequisites.
- No clear workflow exists for role handovers.

## Privacy concerns

Band leaders should not see private exact attributes, hidden skills, XP balances, health details or unrelated progression history. Existing readiness UI can expose enough if reused naively. New coverage output must use readiness bands, requirement met/not met and estimated gaps.

## Possible leader-abuse risks

- Assigning tasks in a way that implies control over another player's XP/AP/currency.
- Scheduling activities without normal acceptance.
- Turning declined tasks into penalties or public shaming.
- Accessing private progression through gap analysis.

## Potential reward exploits

- Repeated trivial custom goals.
- Reusing one lesson/rehearsal event across incompatible rewards.
- Leaving and rejoining to repeat onboarding rewards.
- Multi-profile completion where rules prohibit it.
- Duplicate milestone claims after deletion/recreation.

## Concrete weak-role example

A four-piece band with two guitarists, one vocalist and no bassist/drummer can currently see roles on the roster, rehearse songs and prepare a gig. However, before this PR there was no coherent workflow that says: "bass and drums are missing required general coverage; guitarist two is useful backup guitar coverage; suggested actions are recruit/mentor a bassist, schedule rhythm-section rehearsal, or create a role-handover plan." The band could address the weakness manually through recruitment, rehearsal or lessons, but the system did not coordinate those steps as a measurable shared goal.

## Follow-up band development work

- Move all remaining label-first role calculations onto the shared coverage service.
- Add richer per-band permission capabilities if leader roles become more granular.
- Add UI affordances for privacy preferences once profile privacy settings are expanded.
