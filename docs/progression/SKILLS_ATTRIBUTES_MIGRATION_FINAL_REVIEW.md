# Skills and Attributes Migration Final Review

Applied migrations were not rewritten. The final policy is corrective-only migrations after production verification. Timestamp ordering shows canonical catalogue, analytics, mastery, achievements, band goals, maintenance and balance migrations coexisting with older player skill/attribute split migrations.

## Production-safety instructions

1. Run migrations in a staging clone.
2. Run `npm run validate:progression-programme`.
3. Run Supabase RLS harnesses where environment variables are available.
4. Snapshot affected progression tables before corrective migrations.
5. Never reroll completed songwriting, recording or gig outcomes.
6. Mark uncertain columns deprecated rather than dropping them.
7. Use dry-run repair utilities before writes and retain audit output.

## Review findings

| Area | Status | Notes |
|---|---|---|
| Timestamp ordering | Partial | Future-dated migrations exist; preserve order and apply in sequence. |
| Duplicate table creation | Partial | Skill book migrations have multiple timestamps; verify idempotency in staging. |
| Defaults | Partial | Zero/default skill attributes are intentional but need legacy monitoring. |
| Constraints/FKs | Partial | New corrective migrations should prefer FK integrity for catalogue slugs when safe. |
| Indexes | Partial | Add only after query-plan evidence for ledgers, sharpness and analytics. |
| RLS | Partial | Existing harnesses cover several systems; progression-specific harness remains follow-up. |
| Generated types | Partial | Regenerate after applied migration set is confirmed. |

## Legacy read/write policy

Legacy rows without balance version remain readable and immutable. New writes must store explicit balance version, source event id and canonical skill/attribute keys. Safe defaults may display `Legacy record - details unavailable`, but must not invent contributors or quality breakdowns.
