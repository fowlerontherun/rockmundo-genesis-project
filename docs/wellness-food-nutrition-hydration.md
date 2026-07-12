# Wellness food, nutrition and hydration expansion

This PR expands the existing Wellness foundation instead of creating a separate food economy. It reuses `profiles` for current wellness values, existing company/storefront tables for restaurant ownership and revenue, `player_scheduled_activities` for long food activities, `wellness_history` for idempotent daily summaries, and the current performance/recovery modifier pattern.

## Architecture

Food definitions are server-owned in `food_definitions`. Each definition stores nutrition, energy, hydration, satiety, meal quality, preparation quality, freshness, portion size, sugar, stimulant and alcohol values, recovery support, stress effect, cost, duration, availability, dietary tags, source type and unlock tier. UI code consumes player-facing summaries such as Low nutrition, Balanced, High nutrition, Quick energy, Heavy, Strong hydration and Good for recovery rather than exposing raw coefficients.

Restaurant menus are additive rows in `company_food_menu_items`. The authoritative purchase function `consume_food` validates the chosen food, menu availability, funds, unlock path, price and idempotency key before mutating wellness values, charging the character and crediting the company balance. Clients never submit meal effects.

## Nutrition state

Nutrition is a rolling recent-eating quality score, not a permanent diet simulation. It considers meaningful meals, meal quality, variety/repetition, portion adequacy, missed meals and hydration. The state bands are:

| State | Score |
| --- | ---: |
| Excellent | 86+ |
| Well nourished | 72–85 |
| Adequate | 50–71 |
| Poor | 30–49 |
| Deficient | 0–29 |

Daily food processing expects two meaningful meals by default. One missed meal produces a small drift only; repeated missed meals during workload create gradual consequences.

## Hydration model

Hydration is a lightweight 0–100 state with these bands:

| State | Score |
| --- | ---: |
| Fully hydrated | 88+ |
| Hydrated | 70–87 |
| Slightly dehydrated | 50–69 |
| Dehydrated | 30–49 |
| Severely dehydrated | 0–29 |

Hydration drifts down over time and can be consumed by gigs, rehearsal, exercise, recording and travel hooks. `free_water` is seeded as a zero-cost option so normal play never requires bottled-water purchases.

## Meal categories and effect table

Initial categories are snack, light meal, standard meal, healthy meal, high-protein meal, comfort food, fast food, luxury meal, recovery meal, breakfast, pre-performance meal, post-performance meal and travel meal. Categories set tendencies only; effects come from the concrete food definition, source, freshness and venue quality.

| Seeded option | Role | Unlock | Main trade-off |
| --- | --- | --- | --- |
| Water refill | Hydration safety valve | New Artist | Free hydration, no nutrition. |
| Budget fast-food meal | Cheap quick food | New Artist | Cheap satiety and energy, weaker nutrition/recovery. |
| Standard restaurant meal | Everyday restaurant food | New Artist | Balanced nutrition at moderate cost. |
| Home-cooked balanced meal | Home cooking | Active Musician | Lower cost, more time, requires suitable accommodation in scheduling hooks. |
| Pre-performance light meal | Gig/rehearsal preparation | Active Musician | Modest stable-energy benefit without heavy-meal trap. |
| Post-show recovery meal | Recovery support | Professional Artist | Complements sleep and rest; does not replace them. |
| Premium catering plate | High-end convenience | Superstar | Happiness/convenience with capped wellness effects. |

## Meal timing

Meal timing states are Recently ate, Properly fed, Getting hungry, Hungry and Very hungry. The shared resolver derives timing from the last meaningful meal. Performance hooks apply only bounded readiness penalties; one missed meal does not ruin a gig.

## Restaurants and business quality

Restaurant quality, staff/service quality, cleanliness and ingredient quality can modify meal results within a ±12% cap. Cleanliness also affects rare food-condition risk. High-end restaurants can improve happiness and consistency but cannot bypass nutrition consequences or stack unlimited bonuses.

Restaurant revenue is recorded by crediting the existing company balance in the same authoritative `consume_food` transaction that charges the player. Future integrations can map company staff and supply quality into the existing quality inputs without a new staff framework.

## Home cooking and meal preparation

Home cooking is represented by `home_cooking` food definitions and activity-catalog seeds. The intended scheduling hook validates accommodation/kitchen access, charges grocery cost, spends more time than restaurant meals and applies kitchen quality as a modest preparation-quality input.

`prepared_meals` stores limited charges with freshness and expiry. Prepared meals are convenience and cost-control tools; they are not stronger than premium fresh meals. Expired meals cannot provide full benefits and may raise bounded condition risk.

## Meal plans

Profiles have optional `meal_plan_type` and `meal_plan_daily_budget_cents`. Supported modes are manual, budget, balanced, performance, recovery and luxury. Meal-plan actions are logged in `meal_plan_actions` with an idempotency key so each planned purchase executes once. Plans select existing local food/menu options, respect funds and budgets, downgrade or fail gracefully, and avoid duplicate automatic meals when manual meals already satisfy the window.

## Touring and catering

`tour_catering_plans` stores self-catered, budget, standard, performance and premium catering choices plus forecast JSON for food gaps, hydration availability, estimated cost and at-risk members. Catering benefits should be applied only to attending participants and only once per idempotency key.

Example: a standard catering plan for a three-stop club tour may forecast one travel meal gap after an overnight drive, flag the vocalist for hydration before soundcheck, and recommend a post-show recovery meal after the longest set.

## Accommodation integration

Profiles can receive included breakfast or hotel meal benefits through the same meal history path with `source_type = accommodation`, zero cost when already included, and hotel/restaurant quality as the preparation-quality input. Home kitchen upgrades should feed only modest home-cooking quality changes.

## Performance and recovery caps

Food modifiers are intentionally bounded:

| Modifier | Positive cap | Normal negative cap |
| --- | ---: | ---: |
| Recovery effectiveness | +10% | -15% |
| Performance readiness | +6% | -12% |
| Restaurant quality influence | +12% | -12% |

Songwriting receives only small indirect penalties through energy/concentration; expensive meals do not directly improve songs.

## Food-related conditions

The additive `food_condition_events` table supports upset stomach, food poisoning, indigestion, dehydration and severe hunger fatigue. Conditions are rare and explainable: poor cleanliness, expired prepared meals, severe dehydration, repeated poor nutrition and a bounded random factor. Food poisoning is deliberately uncommon.

## Idempotency, permissions and logging

`meal_consumption_history`, `prepared_meals`, `meal_plan_actions`, `tour_catering_plans` and `food_condition_events` all include idempotency keys. `process_food_daily` writes one `wellness_history` row per profile/day/source. SQL functions emit structured warnings for duplicate-consumption prevention, processing failures and unexpected errors. RLS/API wrappers should enforce that players manage only their own meals, except authorized band/tour roles for catering.

## Migration behaviour

The migration is non-destructive. Existing profiles receive safe hydration, nutrition state, hydration state and manual-plan defaults. Existing restaurants and food purchases continue to work; food menus are additive and can be attached to existing companies. Existing food-like wellness activities remain valid.

## Future hooks

Planned follow-ups include personal chefs, nutritionists, deeper restaurant management, dietary preferences, sponsorship and branded catering, cooking skills, advanced tour riders, seasonal food availability, wellness staff and long-term lifestyle habits.
