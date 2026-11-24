# Festival SVG grounds and owner planning views

This release adds two responsive, keyboard-accessible SVG overviews to the existing Festival experience. Both are **illustrative schematics**, not surveyed maps or evidence of completed operations.

## Visitor grounds

- The optional **Explore illustrated grounds map** action in the published festival's *Stages & grounds* view shows stage hotspots from the edition-scoped public stage projection. Clicking a stage opens the existing selected-stage information; the existing stage cards remain a mobile-friendly fallback.
- Public arrival, food/market, camping and accessibility hotspots use the existing organiser-published visitor information. Empty sections explain that their availability or position has not been verified. Backstage remains restricted and hospitality is not claimed until an approved public projection exists. No privileged details are fetched by this component.
- Stage crowd bands are displayed **only** when the enclosing `FestivalGrounds` view has already validated matching edition/launch identifiers, local festival day, live state, freshness and stage UUID. The new SVG never invents headcounts or infers a live act from a timetable.
- The optional SVG uses a fixed, ordered visual layout; there is deliberately no walking-distance, entrance, route or real-world positioning claim. A true wayfinding map requires a new approved site-location data contract and permission review.
- Keyboard users can activate SVG hotspots with Enter/Space. Published facility buttons and existing stage cards provide HTML alternatives on narrow screens. Lightweight mode leaves the new map collapsed until a visitor opts in.

## Owner planning

- The **Visual planning overview** on the canonical annual-plan screen explains performance, audience, facilities, transport and trading zones. The five SVG zones and matching HTML buttons display the same readable descriptions.
- Capacity and licence constraints come from `get_festival_edition_annual_plan` (specifically `planningEffects`, `expectedCapacity` and server blocker codes) through the existing validated annual-plan query. Unknown figures remain **Not calculated**. The UI does not create stage counts, medical positions, vendor positions or staff levels.
- Owner quick actions open the relevant existing annual-plan section. They are disabled for locked/read-only editions. Licence warnings link to the existing company upgrade route.
- Any unsaved choices produce a warning because the visual summary intentionally reflects the **saved** server projection, not an unverified local estimate.

## Deployment and rollback

These are presentation-only additions. They add no SQL migrations, tables, RPCs, new runtime writes, ticket operations or settlement code. To roll back, remove the `FestivalGroundsMap` opt-in UI and `FestivalPlanningOverlay` inclusion. The canonical edition, public stage and annual-plan RPCs remain unchanged.

## Regression checks

Run the focused unit and screen tests:

```sh
vitest run src/features/festival-company/ui/FestivalGroundsMap.test.tsx src/features/festival-company/ui/FestivalGrounds.test.tsx src/features/festival-company/ui/FestivalStageSchematic.test.tsx src/features/festivals/annual-plan/FestivalPlanningOverlay.test.tsx src/features/festivals/annual-plan/FestivalAnnualPlan.test.tsx
```

The tests cover stage IDs, keyboard/pointer selection, public information and restricted zones, unavailable and verified crowd bands, server-derived capacity, licence warnings, unsaved changes and locked-owner editing.
