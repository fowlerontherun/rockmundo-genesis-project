# Tour Operations, Touring Logistics and Multi-Gig Management

## Architecture reviewed

The phase builds on the existing tour, gig preparation, travel, vehicles, wellness, equipment, crew, booking and live gig architecture rather than replacing it.

- Existing tours already connect gigs through `gigs.tour_id`, use tour wizard state in `src/lib/tourTypes.ts`, aggregate outcomes in `src/hooks/useTourStats.ts`, and display operational detail in `src/components/tours/TourDetailPanel.tsx`.
- Current routing and cost helpers live in `src/utils/tourCalculations.ts` and remain the source for ticket estimates and base travel cost/duration calculations.
- Vehicle tiers and haul capacity are reused from `src/lib/tourVehicles.ts` so the new logistics layer does not introduce a duplicate vehicle catalogue.
- Gig preparation, crew/equipment, production, soundcheck, preshow incidents and live-gig consequences remain the gig-level sources of truth. Tour operations consumes their snapshots and applies cumulative pressure across stops.
- Travel mechanics remain separate in `src/utils/travelSystem.ts`, `src/utils/dynamicTravel.ts`, `src/utils/worldTravel.ts`, and travel UI components. Tour operations calculates campaign feasibility and cost previews while existing travel bookings continue to move players.
- Wellness and fatigue are extended from the existing `src/utils/tourFatigue.ts` threshold model into cumulative tour fatigue that considers route pressure, accommodation and crew fatigue.
- Rehearsal and booking compatibility is preserved by modelling tour stops as scheduled gig events and validating windows before the player commits to impossible multi-gig plans.

## Tour lifecycle

1. Create or reuse a tour template.
2. Select route, venues, production package, crew, vehicles, equipment loadout, merchandise stock and sponsor obligations.
3. Run schedule validation to catch overlaps, missing setup windows, travel impossibility, driver rest risk and performer/crew rest pressure.
4. Start the tour and use Tour HQ as the active operational page.
5. Complete each gig through the existing live gig pipeline.
6. Roll gig outcomes into the tour budget, fatigue, morale, merchandise, regional popularity and reputation.
7. Complete the tour to generate an end-of-tour report and future booking modifiers.

## Logistics engine

`src/utils/tourOperations.ts` adds a pure, deterministic operations engine. It calculates:

- Travel duration using existing travel cost helpers.
- Vehicle capacity using existing vehicle tier haul ratings.
- Equipment loading, transit and repair state.
- Crew movement, shifts, accommodation and fatigue.
- Setup and breakdown windows.
- Driver rest risk on long legs.
- Fuel, flight, hotel, catering, repair, insurance and merchandise costs.
- Schedule warnings and critical blockers.

International visa simulation, customs paperwork, airline management and player-created logistics companies remain out of scope.

## Budget calculations

The rolling budget tracks income from ticket guarantees, door splits, merchandise, sponsorship and VIP packages. Costs include hotels, fuel, flights, ferries placeholder, crew wages, vehicle hire, repairs, catering, venue penalties, marketing, insurance, equipment rental placeholder and merchandise cost of goods/storage/shipping.

The budget is idempotent: the same tour inputs return the same totals, so repeated completion calls do not double-charge.

## Tour HQ implementation

`TourHQPanel` displays:

- Current city and next venue.
- Remaining shows, map stops and calendar stops.
- Rolling budget and tour momentum.
- Crew count, fatigued crew and morale.
- Vehicle tier, capacity, comfort, fuel and repair state.
- Equipment totals, transit, spares, load weight and repair needs.
- Accommodation quality and room requirements.
- Fatigue, health and production status.
- Outstanding schedule/logistics issues.
- Sponsor obligation progress.
- Merchandise stock, sell-through and lost sales.
- Reputation, distance travelled, cities visited and merchandise sold.

## Templates

`TourTemplate` captures preferred crew roles, production package, vehicle setup, accommodation preference, equipment roles, rehearsal schedule, catering, backup equipment, lighting and audio packages. Templates are data-only in this phase so future UI can persist and apply them without changing the operations engine.

## Equipment transport

Equipment now has load weight, transit state, spare status, repair requirements and replacement cost. Tour HQ flags overloaded vehicles and repair needs. Spare equipment reduces event risk and turns backup gear into a strategic tour-planning asset.

## Crew scheduling

Crew members have roles, daily cost, fatigue, morale, experience, shift hours, accommodation state, transit state and real-player markers. Tour HQ summarizes fatigue and morale, while budget calculations include daily crew wages.

## Fatigue and morale

Tour fatigue combines crew fatigue, consecutive-show pressure, travel distance and accommodation recovery. Fatigue lowers health and momentum and can trigger logistics events. Morale combines crew morale, vehicle comfort, accommodation quality and profitability.

## Merchandise planning

The merchandise plan tracks starting stock, unit cost, unit price, reorder quantity, reorder cost, shipping and storage. Tour HQ reports stock remaining, sold units, lost sales and sell-through.

## Sponsor obligations

Sponsors can request fan meets, social posts, VIP appearances, interviews and merchandise promotions. Completed obligations preserve sponsor value; ignored obligations reduce future sponsorship planning modifiers.

## Tour events

The event generator produces contextual logistics events from cumulative risk, including vehicle breakdown and equipment delivery issues. The event contract supports the full requested event taxonomy for future content expansion.

## Regional popularity

Tour stats distinguish city, region and country stop data through tour stop fields. Completed tours can feed future booking confidence, sponsor value, venue confidence and festival invitation chance.

## Statistics and completion reports

The completion report includes financial performance, reputation gained, fans gained, crew performance, equipment wear, vehicle usage, highlights, best/worst gig, most profitable city, strongest audience, biggest media story and future planning modifiers.

## Security and permissions

The database migration uses RLS on tour operations tables. Band members may view tour operations records; leaders/managers write templates, state, ledger rows, equipment manifests, crew schedules, merchandise plans, sponsor obligations, events and reports. RPCs and existing gig booking policies remain the authoritative place for mutating gigs.

## Admin balancing

Constants in the operations engine centralize hotel cost/recovery, vehicle capacity impact, fuel, morale and fatigue formulas. Future admin work can move these constants into existing game-balance admin configuration without changing consumers.

## Testing

Unit tests cover logistics, scheduling, budgets, crew, equipment, fatigue, morale, merchandise, sponsorship, tour events, completion reports, statistics and idempotency. Migration policies cover permissions and security at the database layer.

## Remaining limitations

- Tour HQ is a reusable panel and deterministic engine; wiring it to live Supabase data for every tour detail route should be completed in the next UI integration pass.
- Ferry/customs/flight delays use event contracts but not detailed external markets.
- Regional popularity persistence is schema-ready through report/stat records, but advanced demand decay and oversaturation should be tuned after production data exists.
- Weather is not simulated directly; future work can feed weather modifiers into fatigue/event risk.
