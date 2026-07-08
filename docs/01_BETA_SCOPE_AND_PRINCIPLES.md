# RockMundo Beta Readiness Pack

**Purpose:** Improve and standardise the existing game, reduce bugs, and prepare RockMundo for a controlled beta without a full rewrite.

This pack replaces the earlier oversized “Codex” idea. The goal is practical: stabilise what exists, make the UI clearer, reduce duplicated logic, and create a repeatable beta release process.

## How to use these docs

Add this folder to the repository as:

```text
docs/beta-readiness/
```

Then work through the files in this order:

1. `01_BETA_SCOPE_AND_PRINCIPLES.md`
2. `02_TECHNICAL_DEBT_BACKLOG.md`
3. `03_CODE_STANDARDISATION.md`
4. `04_DATABASE_STABILISATION.md`
5. `05_UI_UX_STANDARDISATION.md`
6. `06_QA_TESTING_AND_BUG_LIMITING.md`
7. `07_BETA_RELEASE_CHECKLIST.md`
8. `08_MONETISATION_READY_FOR_BETA.md`
9. `09_LOVEABLE_PROMPT_PACK.md`

## Core beta objective

RockMundo does not need a rewrite.

RockMundo needs:

- fewer bugs
- clearer navigation
- consistent UI patterns
- standardised data access
- safer database migrations
- better testing
- cleaner release discipline
- limited, ethical monetisation foundations

## Beta rule

For beta, every task should either:

1. reduce bugs,
2. improve consistency,
3. improve onboarding,
4. improve performance,
5. improve player retention,
6. prepare safe monetisation, or
7. make future development easier.

If a task does none of those, defer it until after beta.

## Repo observations used for this plan

This plan is based on the uploaded repository snapshot and screenshots. The project appears to contain:

- React + TypeScript + Vite
- shadcn/Radix style component architecture
- Supabase backend
- a large Supabase migration history
- many gameplay component folders
- extensive existing documentation
- strong visual style, but some navigation and information hierarchy issues

## Recommended beta branch strategy

Create a branch:

```bash
git checkout -b beta-readiness
```

Then implement this pack in phases.

## Suggested folder additions

```text
src/
  services/
  domains/
  hooks/
  constants/
  config/
  lib/
  types/
  components/
    shared/
    layout/
    dashboard/

docs/
  beta-readiness/
```

This does not require moving everything immediately. Use these folders for new or refactored work.
