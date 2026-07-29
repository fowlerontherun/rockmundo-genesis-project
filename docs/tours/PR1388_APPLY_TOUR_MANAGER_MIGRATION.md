# PR1388 — Apply the Tour Manager authority migration

## Required implementation

Run the existing deterministic migration against the real page and commit the generated source change:

```bash
node scripts/migrate-tour-manager-authority.mjs src/pages/TourManager.tsx
```

Then verify and fix any formatting or TypeScript issues without restoring direct browser writes.

## Expected page changes

`src/pages/TourManager.tsx` must:

- import and use `useTourCancellation`
- import and use `useTourTravelRepair`
- import and use `useTourCatchUp`
- remove `useMutation` and `useQueryClient` if no longer required
- remove the four legacy mutation bodies
- call `cancelTour.mutate(selectedTour.id, { onSuccess: ... })`
- close and clear the details dialog after successful cancellation
- disable catch-up when there is no active profile
- display the catch-up fee as `£1,500`
- explain that completed shows and tour history remain visible after cancellation

## Forbidden authority

The page must not directly insert or update:

- tour cancellation state
- gig cancellation state
- band balances or refunds
- tour travel legs
- player travel history
- scheduled travel activities
- profile cash or travel state

## Validation

```bash
npm test -- src/pages/__tests__/TourManager.authority.test.ts
npm test -- scripts/__tests__/migrate-tour-manager-authority.test.ts
npm run typecheck
```

The new page-level test is deliberately expected to fail until the generated `TourManager.tsx` edit is committed. Do not weaken or remove the test to make CI pass.
