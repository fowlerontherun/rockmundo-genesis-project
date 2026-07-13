# Band Progression Design

## Concepts

### Band role coverage

Role coverage answers whether important musical and professional roles are adequately covered for a context: general, gig, recording or songwriting. Coverage uses canonical role-to-skill mappings, member status and privacy-safe readiness bands. It reports required roles, optional roles, ready members, secondary coverage, weak/missing coverage, useful backup coverage and unnecessary duplication warnings. It is not a direct performance multiplier.

### Shared progression goal

A shared goal is a high-level target agreed by the band, such as role coverage, gig readiness, recording readiness, songwriting capability, rehearsal readiness, genre development, professional skill, newcomer onboarding, role handover or guided custom work. Draft/proposed goals do not grant rewards. Custom guided goals may organize work but cannot grant automatic progression rewards unless backed by measurable authoritative requirements.

### Individual contribution task

A task is a voluntary member-facing action linked to a goal. Tasks can be suggested, claimed, assigned where permissions allow, declined, unclaimed or completed by authoritative events. They explain group impact but never spend a member's XP/AP/currency, force skill selection, block leaving, or penalize decline.

### Training plan

A training plan is a coordinated set of real activities and individual work supporting a goal. Steps may reference practice, lessons, mentoring, rehearsals, jams, songwriting, recording, gigs, equipment preparation and attendance confirmation. Booking a future activity does not complete a step; completion derives from authoritative completed events.

### Preparation milestone

A milestone is a measurable readiness threshold, such as all required gig roles covered, setlist familiarity reached, accepted attendance confirmed, a rehearsal completed, recording producer/engineer coverage available, or onboarding first activity completed.

### Band reward

A reward is a modest shared benefit for meaningful coordinated completion: cohesion, reputation, cosmetic badge, morale, preparation-friction reduction or a bounded treasury reward where economy rules allow it. Rewards are server-authoritative, idempotent and never replace individual progression with a band XP level.

## Server-authoritative model

`getBandRoleCoverage` returns context-sensitive coverage using `CANONICAL_ROLE_LINKS`. It does not infer coverage only from role labels and does not expose exact private hidden skill data. Goal requirements are calculated by server/RPC/functions from authoritative data such as skill progress, gig previews, recording previews, songwriting projects, rehearsal attendance and teaching/mentoring completions. Clients cannot directly mark requirements complete or submit reward amounts.

## Templates and suggestions

Templates cover first gig, studio recording, songwriter development, new-member onboarding, live frontperson capability and role handover. Suggestions can be generated from missing roles, upcoming gigs/recordings, setlist familiarity, recent weak outcomes, new members, genre mismatch, production gaps, repeated NPC professional spend and skill-gap analysis. Suggestions explain why they matter and require an authorised action to create a goal.

## Complementary-role logic

The composition score is bounded and planning-only. It recognises critical roles, secondary coverage, specialist diversity, songwriting/recording/live coverage, leadership, production skills and substitute resilience. Duplicate coverage is classified as useful backup or potentially unnecessary duplication; creative non-standard lineups receive warnings and recommendations rather than hard restrictions.

## Synergy design

Group synergy is capped at 2-5% and requires an active shared goal, multiple accepted participants, relevant completed activities, distinct complementary roles, unique source events, active membership and anti-farming checks. A goal's existence alone never grants synergy.

## Milestones and history

Completed and abandoned goals retain historical snapshots: participating members, readiness before/after, linked activities, contribution summary, milestone reward and blocked reasons. Completed goals become read-only except admin repair. Deleted or archived goals cannot reclaim rewards.

## Permissions and privacy

Members can view shared goals, claim tasks, update voluntary notes, suggest changes, decline tasks and mute reminders. Leaders may coordinate goals, tasks and plan proposals where authorised, but cannot spend member resources, schedule without consent or view private progression details. RLS protects goals, tasks, plans, rewards and contributions.

## Gig, recording and songwriting links

Gig-linked goals consume existing gig readiness/preview data for lineup, attendance, setlist, familiarity, rehearsal, health warning bands, equipment, crew and stage setup. Recording-linked goals consume recording preview/session data for source song readiness, role coverage, producer/engineer coverage, studio booking, attendance, equipment and funding. Songwriting-linked goals consume project/contributor data, composition/lyric capability and collaboration status.

## Admin diagnostics and telemetry

Admin diagnostics should show active/completed goals, templates, requirements, tasks, source events, rewards, duplicate attempts, suspicious farming, permission overrides, balance version and blocked records. Telemetry tracks suggestion, creation, activation, task claim/decline, plan-step completion, role-gap resolution, milestone, completion/abandonment, synergy reward, onboarding completion and suspicious repeats without private notes or hidden values.

## Legacy compatibility

Bands can still rehearse, gig, record, write songs, manage attendance and schedule normally without goals. Goals coordinate existing systems; they are not mandatory wrappers.

## Follow-up band development work

- Add full dashboard/detail React surfaces for every lifecycle action.
- Implement edge functions/RPCs that evaluate all requirement types against production tables.
- Expand admin diagnostics from schema/read model to full support console.
- Add screenshot-driven mobile polish once the dashboard UI ships.
