# Progression Simulation Results

Simulation source: `scripts/simulate-progression.ts`.

The script is deterministic and reads the shared `progression_v2.0.0` configuration. In this environment, running it through `npx tsx` was blocked by npm registry policy, so the checked-in examples below are calculated from the same constants.

| Scenario | Expected early result | Long-term result |
| --- | --- | --- |
| Casual player | Level 2 day 2–3, level 5 in roughly 1–2 weeks. | Level 40+ over sustained multi-month play. |
| Regular player | Level 5 in first week, level 10 within first month. | Level 60+ over a year. |
| Highly active player | Level 10 in roughly 1–2 weeks. | Elite levels are reachable but not trivial. |
| Education-focused player | Slower daily repetition, better structured bursts. | Specialist progression outpaces unfocused practice at medium levels. |
| Practice-focused player | Best reliable early progress. | Same-skill diminishing returns prevent runaway grinding. |
| Broad generalist | Several low/medium skills. | Lower elite depth than specialist. |
| Focused specialist | Strongest single-role progression. | Mastery curve still preserves multi-year near-max goals. |
| New-player catch-up | Faster levels 1–10. | Catch-up fades before high mastery. |
| Returning player | Rested low-level boost. | Does not erase veteran advantage. |
| Veteran high skill | Continued measurable progress. | No impossible exponential per-level costs. |

## Warnings

- These are balance estimates, not production telemetry.
- Database-backed server adoption is required before the client can be considered fully non-authoritative.
