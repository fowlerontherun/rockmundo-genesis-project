# Skill Maintenance Simulation Results

Generated with `node scripts/progression/skillMaintenanceSimulation.mjs`.

| Scenario | Policy | Days away | Sharpness | Modifier | Recovery sessions to 99 |
|---|---:|---:|---:|---:|---:|
| active specialist | professional_standard | 21 | 100 | 1 | 0 |
| casual weekly player | advanced_light | 28 | 100 | 1 | 0 |
| monthly player | advanced_light | 90 | 95.8 | 0.995 | 2 |
| 30-day break | professional_standard | 30 | 100 | 1 | 0 |
| 90-day break | professional_standard | 90 | 95.8 | 0.995 | 1 |
| one-year comeback | mastery_specialist | 365 | 80 | 0.969 | 2 |
| multi-role generalist | advanced_light | 90 | 97.2 | 0.997 | 1 |
| mastery specialist | mastery_specialist | 365 | 80 | 0.969 | 2 |

## Interpretation
- Weekly and monthly casual play stays at or near full sharpness because grace periods are long.
- A 30-day break creates no professional-standard rust because it is inside grace.
- A 90-day break has a small practical modifier loss and remains above the protected floor.
- One-year inactivity is bounded by the floor and comeback recovery reaches near-full sharpness in a few relevant sessions.
- Role protection reduces burden for core skills without creating daily attendance pressure.
