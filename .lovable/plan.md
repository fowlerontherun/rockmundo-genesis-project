

## Fix Build Errors

There are 4 distinct issues causing the build to fail:

### 1. Git merge conflicts in `supabase/functions/admin-boost-plays/index.ts`
The file has unresolved merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). I'll resolve them by taking the codex branch version which has better error handling (captures `saleInsertError`, `releaseUpdateError`, etc.) and includes the updated release response.

### 2. Missing `currentGameYear` in `src/pages/Awards.tsx`
The `useGameCalendar` hook is imported but never called. I'll add `const { data: calendar } = useGameCalendar();` and derive `const currentGameYear = calendar?.gameYear ?? new Date().getFullYear();` near the top of the component.

### 3. Invalid `CeremonyPhase` and missing `Masks` icon in `src/components/awards/AwardCeremonyExperience.tsx`
- `CeremonyPhase` type only allows 4 values but `CEREMONY_PHASES` array includes `"after_party"`. Fix: add `"after_party"` to the union type.
- `Masks` is not exported from `lucide-react`. Fix: replace with `Drama` (which exists in lucide-react) or `PartyPopper` as a fallback.

### 4. `src/setupTests.ts` TS error for `@testing-library/jest-dom/vitest`
This is a type declaration issue with the local stub package. Fix: add a `skipLibCheck: true` or simply change the import to suppress the error, or add a `.d.ts` declaration file for the local package.

### Files to edit:
- `supabase/functions/admin-boost-plays/index.ts` — resolve merge conflicts
- `src/pages/Awards.tsx` — add `useGameCalendar()` call and derive `currentGameYear`
- `src/components/awards/AwardCeremonyExperience.tsx` — fix type union and replace `Masks` icon
- `src/setupTests.ts` — fix type import issue

