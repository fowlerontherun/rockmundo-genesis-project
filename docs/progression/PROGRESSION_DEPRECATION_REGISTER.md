# Progression Deprecation Register

| Component | Type | Status | Current dependency | Removal criteria | Planned removal |
|---|---|---|---|---|---|
| Regex/category skill inference | legacy fallback | Deprecated | old SQL/functions may still mention category inference | no production records require it and fallback usage metric is zero for one release | post-programme hardening v2 |
| Raw slug display fallback | UI fallback | Deprecated | unexpected missing catalogue metadata | diagnostics prove no missing metadata in production | next UI cleanup |
| Old quality fields on outcomes | column family | Deprecated | legacy outcome reads | migrated breakdowns or immutable archive confirmed | migration after backup |
| Duplicate XP helper snippets | helper | Deprecated | tests/simulations may contain local expectations | replaced with `progressionBalance.ts` helpers | ongoing opportunistic removal |
| Client-calculated reward previews | compatibility | Deprecated | preview UI only | preview endpoints call server calculators everywhere | next endpoint pass |
| Skill category text on old rows | column | Deprecated | legacy admin views | catalogue FK/link exists for all active rows | after staging query proof |
| Obsolete event names | telemetry | Deprecated | historical analytics | dashboards map old names to canonical taxonomy | analytics migration |

Deprecated components must remain readable until migration proof exists. Do not delete uncertain legacy data.
