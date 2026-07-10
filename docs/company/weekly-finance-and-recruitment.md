# Company weekly finance and recruitment model

## Existing systems extended

- `companies` remains the owner-controlled parent business entity with `balance`, `status`, `reputation_score`, `weekly_operating_costs`, and owner RLS.
- `company_employees` remains the employment table and is extended with NPC/player staff attributes, lifecycle state, role category, weekly wages, contribution fields, unpaid wages, and employment history timestamps.
- `company_transactions` remains the company ledger used by weekly finance runs.
- Existing `jobs` listings remain the public player-facing jobs marketplace; company vacancies can link to those rows and open jobs continue to surface in `/employment`.
- Existing notifications and scheduled-job infrastructure can call `process_company_weekly_finances()` weekly; the function is idempotent via `(company_id, week_start)`.

## Weekly calculation

`weekly profit = gross revenue - total costs`.

Revenue is capped by company type configuration and is based on base weekly revenue, company quality, reputation, staff multiplier, financial-health penalty, and bounded random variation. Costs include active staff wages, company type property/utilities/maintenance/marketing/other costs, plus legacy `companies.weekly_operating_costs`.

## NPC vs real-player staff

NPC staff use stable ratings and a lower multiplier. Real-player staff use skill, activity, and suitability ratings with a higher maximum multiplier, but inactive or unsuitable players can underperform NPCs. Duplicate roles receive diminishing returns and total staff contribution is capped.

## Wage failure behavior

The weekly processor never silently bills the owner's wallet. If revenue plus balance cannot cover costs, company balance is floored at zero, unpaid amount is recorded, active player employees are marked `suspended_unpaid`, unpaid wages accrue, and company performance/financial-warning counters are penalized. The company is not deleted; admins can tune grace weeks in `company_type_definitions`.

## Security

Detailed weekly finance records are visible only to company owners. Vacancies are publicly browsable when open, but only owners can manage them. Players can apply only as themselves and cannot apply to their own company. Duplicate open applications are prevented by a partial unique index.
