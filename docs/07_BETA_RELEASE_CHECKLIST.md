# QA, Testing & Bug Limiting Plan

## Purpose

Reduce bugs before beta and make new bugs easier to find, reproduce, and fix.

## Beta testing philosophy

Do not attempt perfect coverage before beta.

Focus on:

- smoke tests
- critical journeys
- data integrity
- route stability
- economy/progression safety

## Test pyramid for RockMundo beta

```text
Manual exploratory testing
End-to-end smoke tests
Integration tests
Unit tests for calculations
TypeScript/lint/build checks
```

## Minimum automated checks

Before inviting beta users, the project should pass:

```bash
npm run lint
npm run test
npm run build
```

or equivalent package manager commands.

## Critical user journeys

### Journey 1: New player onboarding

- Sign up / log in
- Create character
- Land on dashboard
- See next action
- Open music section
- Start first song

### Journey 2: First music release

- Write song
- Record song
- Release song
- See result/progress
- Gain appropriate XP/money/fame/fans where applicable

### Journey 3: Returning player

- Log in with existing character
- Dashboard loads
- Notifications load
- Active projects load
- No crashes from missing/old data

### Journey 4: Low health/energy

- Reduce energy/health
- Dashboard shows warning
- Risky actions disabled or warned
- Rest/recovery works

### Journey 5: Band basics

- View band state
- Create/join band if supported
- See members
- Perform basic band action

### Journey 6: Admin/bug report

- Tester reports issue
- Admin can see enough information to reproduce

## Route smoke testing

Create a list of all routes and test each one:

| Route | Auth required | New player works | Existing player works | Mobile checked | Status |
|---|---|---|---|---|---|

A route fails beta readiness if it crashes, hangs forever, or has no useful empty state.

## Bug severity

| Severity | Meaning | Beta action |
|---|---|---|
| Critical | data loss, exploit, auth/security issue, app unusable | block release |
| High | core feature broken, repeated crash | fix before wider beta |
| Medium | confusing, incorrect, non-core broken | schedule |
| Low | cosmetic/polish | backlog |

## Bug report template

```md
## Summary

## Steps to reproduce
1.
2.
3.

## Expected result

## Actual result

## Screenshot/video

## Browser/device

## User/profile ID if available

## Console errors

## Severity
```

## Error logging

Add basic client error capture:

- route
- user/profile id where safe
- error message
- stack trace
- browser
- timestamp

Do not log secrets or private content.

## Manual regression checklist

Before each beta build:

- build succeeds
- login works
- character creation works
- dashboard works
- main nav works
- first music action works
- notifications/inbox works
- profile/status values display
- mobile dashboard checked
- no obvious console errors

## Data integrity tests

Check:

- no negative health unless intended
- no impossible energy values
- no NaN values in UI
- no undefined/null shown to players
- no duplicate reward claims
- no repeated XP/money award on refresh
- no player can modify another player’s private data

## Economy exploit checks

Test common exploit patterns:

- refresh page after reward
- double click action button
- open same action in two tabs
- back button after purchase/action
- failed request retry
- client-side value tampering

## Recommended test files

```text
src/__tests__/smoke/routes.test.tsx
src/__tests__/journeys/new-player.test.tsx
src/__tests__/journeys/first-song.test.tsx
src/domains/**/__tests__/*.test.ts
```

## Beta tester process

1. Give testers a short objective list.
2. Ask them to record confusion, not just bugs.
3. Ask what they expected to happen.
4. Ask what made them want to continue or stop.
5. Review reports daily during closed beta.

## Beta bug targets

Before closed beta:

- 0 critical known bugs
- fewer than 5 high known bugs
- core journeys manually verified

Before open beta:

- 0 critical known bugs
- fewer than 2 high known bugs
- no repeated crash reports from closed beta
