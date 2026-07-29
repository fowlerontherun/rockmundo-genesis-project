# Tour Manager full authority migration

This migration removes all remaining browser-authoritative tour management writes from `src/pages/TourManager.tsx`.

## Apply

```bash
node scripts/migrate-tour-manager-authority-v2.mjs
npm test -- scripts/__tests__/migrate-tour-manager-authority-v2.test.ts
npm run typecheck
```

## Replaced actions

- tour cancellation and same-day refund handling
- travel leg regeneration
- travel synchronisation for new band members
- player catch-up travel

The page delegates these actions to:

- `useTourCancellation`
- `useTourTravelRepair`
- `useTourCatchUp`

## Behavioural correction

Cancellation keeps historic tour, gig and travel records. Future activity is cancelled transactionally by `cancel_tour`; the confirmation dialog must not claim those records are deleted.

## Verification

After migration, `TourManager.tsx` must not directly update or insert tour travel, profile travel state, band balances, scheduled travel activities or cancellation state.
