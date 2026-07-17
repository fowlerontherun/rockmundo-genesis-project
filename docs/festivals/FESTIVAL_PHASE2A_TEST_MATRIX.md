# Festival Phase 2A Test Matrix

| Area | Coverage |
| --- | --- |
| SQL | Migration creates revision/item/hour/audit tables, workspace RPC, template preview/apply, item mutation, publication and public projection. |
| Frontend | Workspace loading, day tabs, desktop lanes, mobile agenda, manual slot, template preview/apply, inspector, conflicts, unscheduled panel and publish dialog. |
| Playwright | Desktop and mobile smoke specs are documented for festival admin → schedule → public projection. |
| Gates | `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:festivals:db`, Playwright, and `git diff --check`. |

Phase 2A is complete when a draft can be created, validated and published without changing the public schedule until publication succeeds.
