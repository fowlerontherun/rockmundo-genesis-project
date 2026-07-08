# Beta Release Checklist

## Purpose

A practical go/no-go checklist for launching RockMundo beta.

## Release stages

1. Internal beta
2. Friends/family closed beta
3. Invite closed beta
4. Open beta

Do not skip stages.

## Internal beta checklist

### Build

- [ ] `npm run build` passes
- [ ] `npm run lint` passes or known issues documented
- [ ] `npm run test` passes or known issues documented
- [ ] No obvious console errors on core pages

### Database

- [ ] Fresh database setup documented
- [ ] Required seed data documented
- [ ] RLS reviewed for core tables
- [ ] No destructive migrations pending
- [ ] Backup process known

### Core journeys

- [ ] New account works
- [ ] Character creation works
- [ ] Dashboard works for new player
- [ ] First music action works
- [ ] Returning player works
- [ ] Bug report flow works

### UI

- [ ] Main navigation reduced to beta-ready features
- [ ] Unfinished pages hidden or labelled
- [ ] Dashboard has next action
- [ ] Loading states exist for core pages
- [ ] Empty states exist for core pages
- [ ] Error states exist for core pages
- [ ] Mobile dashboard checked

## Closed beta checklist

- [ ] Tester instructions written
- [ ] Known issues list published
- [ ] Bug report template available
- [ ] Admin can identify reporter/profile
- [ ] Critical telemetry/error logging available
- [ ] Discord/community feedback channel ready
- [ ] Beta reset policy documented
- [ ] Player data policy documented

## Open beta checklist

- [ ] Closed beta critical issues fixed
- [ ] Performance checked with more users
- [ ] Economy exploit checks completed
- [ ] Moderation/reporting process available
- [ ] Terms/privacy pages ready
- [ ] Premium/payment disabled or safely sandboxed unless fully audited
- [ ] Public known issues page available
- [ ] Support contact available

## Go/no-go decision

### Go if:

- no known critical bugs
- core loop works
- database setup stable
- testers know how to report bugs
- unfinished systems are hidden or clearly marked

### No-go if:

- auth is unreliable
- character creation breaks
- dashboard fails for new players
- rewards can be duplicated easily
- players can access/modify other players’ private data
- database migrations are uncertain
- no one can see or triage bug reports

## Beta release notes template

```md
# RockMundo Beta Build X

## New / changed

## Fixed

## Known issues

## What to test

## How to report bugs

## Data reset warning
```

## Post-release routine

During first beta week:

- review errors daily
- review bug reports daily
- patch critical issues quickly
- avoid adding new features
- keep a changelog
- communicate fixes clearly

## Beta success signs

- players return without reminders
- players understand what to do next
- players create stories/screenshots
- few support requests are about navigation confusion
- bugs are reproducible
- core database does not require manual repair
