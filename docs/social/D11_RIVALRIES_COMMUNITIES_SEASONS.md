# D11 — Rivalries, communities and seasonal social competition

## Goal

D11 adds friendly social competition without creating a progression shortcut or harassment channel. Player and band rivalries require consent, communities have guarded membership and owner controls, and seasonal standings compare verified growth from fixed baselines. The only rewards are bounded prestige badges and permanent history.

The desktop route is `/social/competition`. Mobile uses the same feature at `/mobile/social/competition`, so consent, safety, scoring and reward language do not diverge between clients. Legacy `competition`, `communities`, and `rivals` Social tabs normalise to the unified route.

## Player rivalries

Player discovery requires an exact username and hides the active character, missing profiles and either-direction block relationships. A challenge includes one verified growth metric and a target:

- fame gained;
- fans gained;
- experience gained;
- target from 10 to 1,000,000.

The target player may accept or decline. Requests expire after seven days. Acceptance snapshots both canonical profile values and starts a 30-day competition. Either participant may end a pending or active rivalry without a loss, gameplay penalty or reward transfer.

Spam and replay controls include:

- at most three outgoing pending player requests;
- at most five pending requests targeting one player;
- at most three active rivalries per participant;
- one open rivalry per unordered player pair;
- seven-day cooldown after a declined, ended or completed pairing;
- one rivalry-winner badge per rivalry and profile.

Score refreshes read the canonical profile columns on the server. Client-supplied score or winner values are never accepted. A target-reaching or expired rivalry finalises once, stores the scores/winner and appends an event-history row.

## Band rivalries

Active band leaders, founders, co-leaders and managers can discover an exact active band and issue a challenge for fame or fan growth. A manager of the target band must accept. Every active member of either band can see the rivalry and ask the server to refresh it, but ordinary members cannot accept, decline or end it.

Band rivalries share the player lifecycle limits: seven-day request expiry and pair cooldown, 30-day active duration, three pending challenges per band, three active rivalries per band, canonical baseline scoring, permanent history and no-penalty manager exit.

The initiating and accepting profiles remain attached to the band rivalry for safety enforcement. A block between those actors closes an active interaction, while discovery and request creation reject a target band when a target manager has a block boundary with the initiating profile.

Band results are history only. They do not grant player/band money, fame, fans, XP, AP, stats or inventory.

## Communities

An authenticated character may create up to five communities as one of:

- fan club;
- scene;
- learning;
- general.

Names are 3–60 characters, descriptions are at most 500 characters, and capacity is 2–500 members. The owner is inserted as the first active member. A character may hold at most 20 active community memberships.

Open communities appear in the directory. Private communities appear only to the owner and current members. Communities owned by a blocked profile are not returned. Joining locks the community and profile membership decision so concurrent requests cannot exceed capacity or the membership cap.

Members can leave without penalty. Owners cannot leave their own community through the member exit. Owners can open/close joins, change the description/capacity, view active members and remove a non-owner member. A removed member has a seven-day rejoin cooldown. Owner and member rows use the shared block/report actions where the UI has a player target.

Announcements, community projects and owner transfer are intentionally outside D11.

## Seasonal competition

Social seasons run for 28 days. The live rollover function finalises ended seasons, expires stale rivalry requests, settles expired active rivalries and creates the next season. `pg_cron` invokes it daily at 00:05 UTC.

Entries choose one context and metric:

| Context | Grouping |
|---|---|
| Global | All eligible entries for the metric |
| City | The character's city captured at initial entry |

| Metric | Score |
|---|---|
| Fame gained | Current canonical fame minus fixed fame baseline |
| Fans gained | Current canonical fans minus fixed fans baseline |
| Experience gained | Current canonical experience minus fixed experience baseline |

Each auth account has at most one row per season/context/metric, independent of character slots. Rejoining the same entry clears withdrawal but never resets the original baseline or city snapshot. Scores cannot be negative.

Finalisation stores the canonical final score and dense rank within context, captured city and metric. Only active, award-eligible entries with positive growth can earn recognition. Rank 1 receives the D11 season champion badge; ranks 2–10 receive the D11 season top-ten badge. The unique award boundary makes repeated finalisation safe.

## Database authority

All D11 schema and RPC changes were applied directly to live Supabase. There is no migration file in this branch.

Canonical state uses:

- `social_rivalries`;
- `social_rivalry_events`;
- `social_communities`;
- `social_community_memberships`;
- `social_competition_entries`;
- shared `leaderboard_seasons`, `leaderboard_badges`, and `leaderboard_badge_awards` rows.

The five D11 state tables have RLS enabled, explicit service-role policies, and no anonymous/authenticated direct table privileges. The shared leaderboard tables retain intended browser reads but have no browser insert/update/delete privileges. Authenticated clients call only identity-checking `SECURITY DEFINER` RPCs with fixed search paths. Internal helpers, season finalisation and rollover are not executable by browser roles.

## Verification

`supabase/tests/d11_social_competition_harness.sql` runs a complete transaction against the connected database and rolls it back. It proves:

1. anonymous RPC/table and authenticated direct-table access is denied;
2. player discovery, invitation, consent and unrelated-response denial;
3. canonical score completion and rivalry-badge idempotency;
4. no-penalty exit and pair cooldown;
5. manager-only band consent/end with ordinary-member view/refresh;
6. block-aware player and band discovery/request denial;
7. community capacity, member listing, owner removal and rejoin cooldown;
8. one-account seasonal entry across character slots;
9. fixed-baseline withdrawal/rejoin and captured city context;
10. service-only finalisation, positive-growth rewards and idempotency;
11. zero retained fixture rows after rollback.

The production harness passes. Supabase security and performance advisors have no actionable D11-scoped findings; expected authenticated `SECURITY DEFINER` notices describe the deliberately narrow RPC boundary, and unused-index notices are expected until new production paths accumulate traffic.
