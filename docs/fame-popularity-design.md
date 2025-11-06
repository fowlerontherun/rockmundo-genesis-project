# Fame and Popularity Systems Overhaul Design

## Background
Rockmundo currently tracks band and character fame as a cumulative metric that increases when gigs or scripted fame events occur. Popularity exists as a static modifier consumed by sales simulations, but no first-class systems alter it over time. Fame gains are linear and lack decay, regional variance, or player-driven modifiers, resulting in shallow progression and limited strategic decision-making.

## Goals
- Transform fame and popularity into dynamic, time-sensitive stats that respond to player choices and inactivity.
- Differentiate fame (long-term renown) from popularity (short-term buzz) with distinct gain, decay, and multiplier rules.
- Introduce new narrative and management systems that create interesting trade-offs in fame/popularity outcomes.
- Provide analytics and tooling for players and designers to monitor, tune, and balance the new systems.

## Non-Goals
- Overhauling combat, audio, or unrelated economic systems.
- Building final art assets for new UI elements (wireframes and data wiring only).
- Implementing fully automated balancing; tooling focuses on manual adjustments and telemetry.

## High-Level Approach
Deliver changes in six iterative tracks that layer core mechanics, event hooks, segmentation, narrative complexity, career progression, and analytics support. Each track is scoped to unlock playable value while preparing data for subsequent layers.

## Detailed Plan

### 1. Fame & Popularity Core Systems Overhaul
Establish decay, multipliers, and shared utilities that drive both fame and popularity updates.
- Extend database schemas (Supabase functions, migrations) with decay rates, timestamps, chemistry multipliers, and fame/popularity history tables.
- Implement scheduled decays using Supabase cron jobs or simulated timers to decrement stats when bands or characters are inactive.
- Refactor fame update helpers (`awardBandFame`, character fame mutations) to apply multipliers based on chemistry, milestones, and career phases.
- Update client stores/hooks to fetch and display live values, including projected decay timers and current multipliers.

### 2. Popularity Event Hooks & Media Exposure
Attach popularity mutations to player actions that currently only influence fame or revenue.
- Identify touchpoints such as social posts, radio plays, marketing actions, and release promotions, adding popularity gain/loss calculations with diminishing returns.
- Create shared popularity delta utilities that incorporate regional modifiers and PR agent bonuses.
- Enhance UI flows to preview expected popularity effects, encouraging informed decisions.
- Persist popularity event logs and expose them in player dashboards.

### 3. Regional & Fan-Segment Segmentation
Represent geography and fan personas so actions affect targeted audiences differently.
- Expand schemas with region identifiers, fan segment profiles, and seed data for default markets.
- Adjust tour/gig endpoints to read/write segment-specific fame/popularity and tie attendance forecasts to local demand.
- Update simulation utilities to use segmented metrics for revenue, attendance, and merchandise projections.
- Visualize regional heatmaps and segment sentiment in analytics panels.

### 4. Narrative Events, Controversies, and Rivals
Add narrative-driven systems that create asymmetric fame/popularity shifts.
- Define event templates (scandals, collaborations, rival interactions) with configurable outcomes and probability/skill checks.
- Model rival bands capable of siphoning popularity or fame in overlapping segments/regions.
- Implement branching event processors that resolve trade-offs (e.g., fame spike vs. popularity drop).
- Surface events through notifications and decision dialogs in the UI.

### 5. Career Progression & Management Roles
Introduce long-term trajectories and supporting cast that shape stat evolution.
- Define career phases (rookie, breakout, superstar) with thresholds controlling base gain, decay, and multiplier behavior.
- Create management role entities (PR agent, social media manager) with skills affecting fame/popularity adjustments and unlocking mini-games.
- Build lightweight mini-games or choice-based interactions whose success/failure temporarily modifies stats.
- Update onboarding/tutorial content to explain new systems and management roles.

### 6. Analytics, Logs, and Balancing Tools
Provide visibility and control over the expanded systems.
- Extend fame/popularity history tables and expose them through Supabase views or API endpoints for dashboards.
- Build admin/balancing interfaces to tweak decay rates, multipliers, and event weights in real time.
- Add telemetry hooks capturing player interactions for future balancing analysis.
- Author automated tests covering new fame/popularity flows, ensuring regression protection for gig simulations and existing features.

## Risks & Mitigations
- **Data volume growth:** New history tables may expand storage and query costs. Mitigate with aggregation views and archival policies.
- **Balance complexity:** Introducing multiple multipliers risks runaway stat inflation. Provide designer tooling and guardrails (caps, diminishing returns).
- **Player overwhelm:** Additional systems may confuse newcomers. Address with tutorials, progressive feature unlocks, and UI previews of stat changes.

## Milestones & Phasing
1. **Milestone 1:** Core decay/multiplier backend, client display updates, baseline tests.
2. **Milestone 2:** Popularity hooks and regional data integration with UI previews.
3. **Milestone 3:** Narrative events and rival systems with decision interfaces.
4. **Milestone 4:** Career phases, management roles, and mini-game prototypes.
5. **Milestone 5:** Analytics dashboards, balancing tools, telemetry, and expanded automated tests.

## Open Questions
- Should fame decay be global or region-specific, and how frequently should cron jobs execute?
- What is the desired granularity for fan segments (demographics, genre preference, engagement level)?
- How should mini-game outcomes integrate with existing energy/health systems?
- Do we need cross-platform notifications (email, push) for major fame/popularity events?

