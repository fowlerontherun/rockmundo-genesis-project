# Festival Completion PR 5 — condition stats + basic activities

This slice introduces the first executable attendee actions without creating a second permanent wellness or commerce system.

## Authority boundary

- Temporary Festival condition state lives in `festival_attendee_conditions` and is one row per attendee/edition.
- It is seeded from existing permanent wellness values where available, but is not itself permanent wellness.
- Production currently does not expose the repository's newer `profiles.hydration` column, so hydration seeding intentionally uses `to_jsonb(profiles)` and a neutral fallback instead of compiling against that optional column.
- Condition evolution happens server-side in 30-minute elapsed-time ticks while the character is authoritatively `attending`.
- Clients cannot submit condition deltas.

## Temporary stats

- Energy: higher is better.
- Hunger: higher means hungrier.
- Hydration: higher is better.
- Mood: higher is better.
- Intoxication: higher means more intoxicated. This slice does not provide alcohol purchases, so activity resolution does not raise it yet; elapsed time can reduce it for future compatibility.
- Social: higher is better.

## Executable planner actions

`Eat`, `Drink`, `Explore` and `Rest` can resolve only while their own authoritative planner window is active.

A successful resolution:

1. locks the planner row;
2. confirms the active character owns the still-attending Festival lifecycle;
3. evolves condition state to server `now()`;
4. applies server-owned bounded effects based on activity type and 30/60/90-minute duration;
5. writes one immutable `festival_attendee_activity_resolutions` row containing before/effect/after state;
6. marks the planner item `completed`;
7. returns the persisted result.

A retry of the same completed planner item returns the persisted result instead of applying effects again.

If the block has expired unresolved, it becomes `missed` and no effects are applied. Future blocks cannot be executed early.

## Consumed-time rule

Completed blocks continue to occupy their original time range. New `planned` blocks are rejected when they overlap either another `planned` block or a `completed` block. This prevents resolving a long block at its start and immediately stacking another activity into the same time.

## Deliberately deferred

This slice does not implement:

- commercial food/drink purchasing or Festival-company revenue;
- alcohol selection or permanent lifestyle consequences;
- XP/AP, inspiration or skill rewards;
- random events;
- social relationships;
- Watch Act/timetable resolution;
- camping/sleep;
- performer audience bonuses;
- owner engagement multipliers.

Those remain later bounded Festival completion slices.
