# Festival historical legacy (Phase 9B)

Phase 9B begins only after Phase 9A reaches `settled`. The settlement transition publishes one result, rooted by the runtime outcome and final settlement snapshot IDs and digests. Generation is idempotent. Results, reviews, reputation evidence, awards, and publications reject updates and deletes; corrections require a new explicit product version rather than rewriting history.

Public, read-only RPCs expose results/history, annual awards, current world records, aggregate statistics, and the Hall of Fame. Every archive query supports the shared year, country, city, festival type, and genre dimensions where applicable. Direct table access remains revoked.

The result generator derives reviews and reputation evidence without adding finance or runtime behavior. Large and major editions publish summaries for World Pulse, RockMundo FM, Twaater, and scoped news feeds. The season worker calls `generate_festival_season_awards(year)` after the final edition settles; it is service/admin guarded and idempotent.

## Verification

Apply migrations to a disposable database and run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_historical_legacy_harness.sql
npm run test:unit -- src/features/festivals/legacy/__tests__/model.test.ts
```
