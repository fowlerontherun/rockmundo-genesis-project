# Mastery simulation results

Deterministic simulation seed: static v1 archetype table. Weekly XP estimates include quality, difficulty and repetition penalties.

| Archetype | Rank 1 | Rank 2 | Rank 3 | Rank 4 | Notes |
|---|---:|---:|---:|---:|---|
| focused specialist | 3 weeks | 10 weeks | 29 weeks | 78 weeks | cap 0.10; trivial grind fastest: false |
| broad veteran | 6 weeks | 21 weeks | 62 weeks | 167 weeks | cap 0.10; trivial grind fastest: false |
| highly active performer | 3 weeks | 9 weeks | 25 weeks | 67 weeks | cap 0.10; trivial grind fastest: false |
| recording professional | 4 weeks | 13 weeks | 41 weeks | 113 weeks | cap 0.10; trivial grind fastest: false |
| songwriter | 4 weeks | 16 weeks | 49 weeks | 135 weeks | cap 0.10; trivial grind fastest: false |
| teacher | 5 weeks | 17 weeks | 50 weeks | 135 weeks | cap 0.10; trivial grind fastest: false |
| casual long-term player | 13 weeks | 48 weeks | 145 weeks | 389 weeks | cap 0.10; trivial grind fastest: false |

## Interpretation

- Focused specialists reach early recognition in months, while Virtuoso remains a multi-year goal.
- Broad veterans progress more slowly because rewards are distributed across multiple skills.
- Recording professionals and songwriters use elite curves, reflecting fewer but higher-value events.
- Teaching contributes meaningfully but is not optimal because unique-student and loop safeguards reduce repeated pair rewards.
- The total direct numerical advantage remains capped at 10%, with most configured effects below 8% per path.

## Follow-up veteran progression work

- Replace static archetype assumptions with production telemetry once mastery ledgers are live.
- Add per-source percentile bands and automatic grind outlier reports to admin diagnostics.
