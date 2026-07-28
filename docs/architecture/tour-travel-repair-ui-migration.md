# Tour Manager travel repair migration

The authoritative repair APIs introduced in this stack are exposed to React through `useTourTravelRepair`.

The remaining UI migration is intentionally limited to replacing the two legacy mutations in `src/pages/TourManager.tsx`:

- `regenerateTravelLegsMutation` → `regenerateTravelLegs`
- `addNewMemberTravelMutation` → `syncMemberTravel`

The catch-up flight mutation is a separate financial and travel transaction and must not be folded into the repair operation.

When the page migration is applied, remove all browser-side inserts into:

- `tour_travel_legs`
- `player_travel_history`
- `player_scheduled_activities`

The repair buttons should retain their existing loading states while using the hook mutation objects directly.
