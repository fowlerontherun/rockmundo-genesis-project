# D11 — Rivalries, Communities and Seasonal Social Competition

## Delivery

D11 closes the consolidated backlog item for safe opt-in rivalries, contextual social competition, player communities and seasonal recognition.

All database changes for D11 were applied directly to the live Supabase project. This repository change intentionally contains no D11 migration file.

## Rivalries

- Rivalries are explicit invitations between two player profiles.
- The invited player must accept before any progress counts.
- Either participant may leave without a gameplay penalty.
- Existing player blocks prevent discovery/request acceptance and close active rivalries on refresh.
- Rivalry scores are derived only from canonical profile growth after the acceptance baseline.
- Clients cannot submit or directly mutate scores.
- Requested, accepted, declined, progress, completed, ended and block-closed events are retained as server evidence.
- Only one pending/active rivalry may exist for a player pair at a time.

## Seasonal competition

D11 reuses the canonical `leaderboard_seasons`, `leaderboard_badges` and `leaderboard_badge_awards` model rather than introducing a second season system.

Players explicitly opt into a season/context/metric. Their starting metric is frozen on first join and is not reset by leaving/rejoining. Rankings are therefore based on growth during the competition rather than absolute accumulated wealth/fame and cannot be supplied by the browser.

Supported contexts are global and current city. Supported growth metrics are fame, fans and experience. Blocked players are excluded from each other's projected leaderboard.

Trusted season finalisation can grant idempotent `Season Champion` and `Season Top 10` recognition through the existing leaderboard badge-award model. The finaliser is service-role only.

## Communities

Player communities support bounded fan-club, scene, learning and general groups. Creation and membership are RPC-controlled, membership is opt-in, communities have capacity limits, and blocked relationships are excluded from discovery/join paths. Community owners cannot silently abandon ownership through the normal leave action.

## Security

Canonical D11 tables have RLS enabled. Browser roles have no direct table privileges; all player-readable state is projected through permission-checked RPCs. Internal ownership/metric helpers are not browser executable, and all D11 security-definer functions use explicit search paths.

## Verification

A rollback-only production lifecycle verified:

1. a real profile could request a rivalry against an eligible player;
2. the invited profile explicitly accepted;
3. only canonical post-acceptance fame growth advanced and completed the rivalry;
4. two players could opt into a temporary canonical leaderboard season and the growth leader ranked first;
5. a player-created community accepted an eligible second member;
6. all fixture mutations were rolled back.

Focused frontend regression coverage also prevents direct D11 table mutations from being introduced and confirms the existing community feed remains present alongside the new Social Competition view.
