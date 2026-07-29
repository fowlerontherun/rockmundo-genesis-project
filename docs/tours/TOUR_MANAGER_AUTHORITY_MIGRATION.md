# Tour Manager authority migration

Run:

```bash
node scripts/migrate-tour-manager-authority.mjs
```

The codemod updates `src/pages/TourManager.tsx` to:

- import `useTourTravelRepair`
- import `useTourCatchUp`
- remove the legacy browser mutation bodies for travel-leg repair, new-member travel and catch-up flights
- wire the existing buttons to the authoritative mutations
- disable catch-up when there is no active profile

After running it, verify:

```bash
npm test -- scripts/__tests__/migrate-tour-manager-authority.test.ts
npm run typecheck
```

The resulting page must not directly insert into `tour_travel_legs`, `player_travel_history` or `player_scheduled_activities`, and must not update profile cash or travel state for catch-up journeys.
