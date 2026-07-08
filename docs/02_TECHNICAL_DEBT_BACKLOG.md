# Beta Scope & Principles

## Goal

Get RockMundo into a stable, enjoyable beta without rewriting the project.

The beta version should prove that players can:

- create a character
- understand what to do next
- make progress in a music career
- interact with the core systems
- return daily
- avoid major bugs or broken flows
- see enough value to support the game commercially later

## What beta is not

Beta is not the time to add every planned feature.

Avoid adding new major systems unless they directly support onboarding, retention, stability, or monetisation readiness.

## Beta design principle

**Standardise before expanding.**

The project already has a broad feature set. Beta success depends on making the existing systems reliable, understandable, and connected.

## Beta feature scope

### Must be stable

- Authentication
- Character creation
- Dashboard
- Profile/status display
- Core music loop
- Songwriting
- Recording
- Releases
- Charts or progress feedback
- Band basics
- Money display
- XP/skills progression
- Notifications/inbox
- Navigation
- Mobile/tablet usability
- Admin bug visibility

### Should be present but can be simple

- Relationships
- Education
- Gigs
- Streaming
- Social media
- Festivals
- Record labels
- Businesses
- Properties
- Premium/cosmetic placeholder pages

### Should not block beta

- Deep politics
- Crime/prison systems
- complex NPC simulation
- very advanced economy simulation
- multi-year generational systems
- heavy 3D/avatar polish
- large-scale live events

## Beta player promise

A beta player should be able to say:

> I know who my character is, what they are trying to achieve, what I should do today, and why my actions matter.

## Release philosophy

Use a polish-first beta cycle:

1. Stabilise routes.
2. Stabilise database.
3. Stabilise core loops.
4. Standardise UI.
5. Add tests.
6. Add telemetry/bug reporting.
7. Invite small beta group.
8. Fix issues.
9. Expand gradually.

## Feature freeze rule

Before beta, create a temporary feature freeze.

Only allow:

- bug fixes
- UI consistency fixes
- performance improvements
- database safety fixes
- onboarding improvements
- release checklist tasks

## Beta quality bar

A feature is beta-ready when:

- it loads without errors
- it handles empty states
- it handles loading states
- it handles failed Supabase calls
- it has no obvious console errors
- it works on desktop and mobile width
- the player understands the next action
- it cannot create impossible or corrupt game state

## Cut list for beta

For every screen, assign one status:

| Status | Meaning |
|---|---|
| Beta Core | Must be reliable for beta |
| Beta Basic | Can be simple but working |
| Hidden | Hide from navigation until ready |
| Admin Only | Keep available for testing only |
| Post Beta | Defer |

## Recommended beta navigation

Reduce visible navigation for beta. Keep advanced systems accessible only once stable.

Suggested top-level beta nav:

- Dashboard
- Character
- Music
- Band
- World
- Social
- Career
- Store/Premium

Everything else should be nested or hidden until stable.

## Success metrics

Track:

- signup completion rate
- character creation completion rate
- first-song completion rate
- day-one retention
- day-seven retention
- crashes/errors per session
- average session length
- feature usage
- bug reports per active user
- conversion interest for premium features

## Beta exit criteria

RockMundo can move from closed beta to open beta when:

- no critical data-loss bugs remain
- no obvious economy exploits remain
- all core pages have loading/error/empty states
- navigation is understandable
- the dashboard tells players what to do next
- database migrations are stable
- basic admin/bug-report tooling exists
- at least 20–50 testers can play for a week without manual database repair
