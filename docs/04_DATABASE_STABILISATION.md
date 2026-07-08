# Code Standardisation Plan

## Purpose

Create consistent patterns across the existing codebase without rewriting it.

RockMundo has a large React/TypeScript surface area. Bugs will reduce faster if every page follows the same basic structure.

## Non-negotiable rule

React components should display and collect input. They should not own core gameplay calculations.

## Preferred page structure

Each page should follow this pattern:

```tsx
export default function FeaturePage() {
  const { data, isLoading, error } = useFeatureData();

  if (isLoading) return <PageLoading />;
  if (error) return <PageError error={error} />;
  if (!data) return <PageEmpty />;

  return <FeatureView data={data} />;
}
```

## Standard folders for new/refactored code

```text
src/
  components/
    shared/
    layout/
    cards/
    forms/
    feedback/
  domains/
    music/
    economy/
    progression/
    social/
    world/
  hooks/
  services/
  constants/
  types/
  utils/
```

Do not move all existing files at once. Move only when touching a feature.

## Services

Use service modules for data access and gameplay operations.

Example:

```text
src/services/musicService.ts
src/services/profileService.ts
src/services/bandService.ts
```

Each service should:

- call Supabase
- return typed data
- throw useful errors
- avoid UI dependencies
- avoid toast messages

## Domain modules

Use domain modules for calculations.

Example:

```text
src/domains/music/calculateSongQuality.ts
src/domains/economy/calculateGigIncome.ts
src/domains/progression/calculateXpGain.ts
```

Domain modules should be pure where possible.

## Hooks

Use hooks to connect React to services.

Example:

```text
src/hooks/usePlayerProfile.ts
src/hooks/useMusicProjects.ts
src/hooks/useCreateSong.ts
```

Hooks should:

- use React Query where possible
- manage loading/error state
- call services
- invalidate relevant queries

## Error handling standard

Every Supabase call should handle:

- network failure
- permission failure
- no rows
- unexpected rows
- invalid input

Use shared error helpers:

```text
src/lib/errors.ts
```

Recommended error categories:

- `ValidationError`
- `PermissionError`
- `NotFoundError`
- `DatabaseError`
- `UnexpectedError`

## UI feedback standard

Use consistent patterns:

- success toast after successful action
- error toast with friendly text
- inline validation for form errors
- confirmation dialog for destructive actions
- loading button state for mutations

## TypeScript standards

- Avoid `any` in new code.
- Prefer explicit return types for service functions.
- Export shared types from `src/types` or domain folders.
- Use Zod for input validation on important forms.
- Use discriminated unions for status-heavy systems.

## Naming standards

### Components

`PascalCase.tsx`

Example:

```text
SongCard.tsx
BandDashboard.tsx
```

### Hooks

`useThing.ts`

Example:

```text
useSongs.ts
useBandMembers.ts
```

### Services

`thingService.ts`

Example:

```text
songService.ts
```

### Domain calculations

`calculateThing.ts`

Example:

```text
calculateSongQuality.ts
```

### Constants

`SCREAMING_SNAKE_CASE` for constant values.

## Component size guidelines

| Size | Action |
|---|---|
| 0–200 lines | Fine |
| 200–400 lines | Review when touched |
| 400–700 lines | Split if logic is mixed with UI |
| 700+ lines | High risk; refactor during beta cleanup |

Do not split purely for aesthetics. Split when it reduces bugs.

## Shared components to create/standardise

- `PageShell`
- `PageHeader`
- `SectionHeader`
- `StatCard`
- `ActionCard`
- `ProgressCard`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `ConfirmDialog`
- `StatusBadge`
- `BetaNotice`

## Query key standard

Use consistent query keys:

```ts
['profile', profileId]
['songs', profileId]
['band', bandId]
['notifications', profileId]
```

Avoid unstructured string keys.

## Mutation standard

Every mutation should:

1. validate input
2. call a service
3. invalidate query keys
4. show success/error feedback
5. avoid direct state hacks unless needed for optimistic UI

## Anti-patterns to remove gradually

- direct Supabase calls scattered across components
- duplicated calculations
- silent failed queries
- hardcoded status strings
- pages with no empty state
- pages with no loading state
- pages with no mobile consideration
- business logic inside JSX
- multiple components solving the same UI problem differently

## Pull request checklist

Every PR should answer:

- Does this touch beta core?
- Does it add or remove a route?
- Does it change database behaviour?
- Does it affect money, XP, fame, health, energy, or premium items?
- Are loading/error/empty states handled?
- Is the UI consistent with shared components?
- Were tests updated or manual verification added?
