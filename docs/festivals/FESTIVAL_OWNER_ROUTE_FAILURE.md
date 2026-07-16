# Festival owner route failure capture

## Reproduction attempt

- Date: 2026-07-16
- Route under investigation: `/festivals/:festivalId/manage` and `/festivals/:festivalId/manage/editions/:editionId`
- Failing client path before this fix: `FestivalOwnerConsole` → `useOwnerFestivalEditions(festivalId)` → `fetchOwnerFestivalEditions(festivalId)` → `festival_owner_edition_options(p_festival_id)`.

The runtime route could not be fully reproduced against production from this container because no authenticated owner session is available and the environment proxy rejected a direct Supabase REST call before it reached PostgREST (`curl` returned `CONNECT tunnel failed, response 403`). Therefore the production-only fields below are intentionally recorded as unavailable rather than guessed.

## Captured request details

| Field | Value |
| --- | --- |
| Requested festival ID | Unavailable in this container; no browser session or screenshot URL was provided. |
| HTTP status | Unavailable for the authenticated browser request. An unauthenticated direct REST attempt was blocked by the environment proxy before PostgREST. |
| PostgREST error code | Unavailable; request did not reach PostgREST from this container. |
| Database message | Unavailable; request did not reach PostgREST from this container. |
| Details | Unavailable; request did not reach PostgREST from this container. |
| Hint | Unavailable; request did not reach PostgREST from this container. |
| Authenticated user ID | Unavailable; no authenticated owner session is present in the repository environment. |
| Resolved profile ID | Unavailable; no authenticated owner session is present in the repository environment. |
| Exists in `festivals` | Unavailable for the reported ID. |
| Exists in `game_events` | Unavailable for the reported ID. |
| Exists in `festival_legacy_mappings` | Unavailable for the reported ID. |
| Canonical editions exist | Unavailable for the reported ID. |
| Current profile owns the brand | Unavailable for the reported ID. |
| Delegated roles exist | Unavailable for the reported ID. |

## Confirmed root cause in code

The owner console used the route parameter as if it were always a canonical `festivals.id`, then called `festival_owner_edition_options(p_festival_id)` directly. That RPC only filters `festival_editions.festival_id = p_festival_id`, so canonical edition IDs, legacy `game_events.id` values, mapped dedicated festival rows, and unresolved legacy IDs cannot bootstrap the management route. The React page then collapsed every RPC/query failure into the same `FESTIVAL_EDITION_OPTIONS` message, hiding whether the actual state was not found, access denied, migration blocked, RPC missing, no editions, or invalid route identifier.

## Corrective direction

This PR replaces the brittle edition-options startup path with `festival_owner_management_bootstrap(p_identifier)`, which resolves the route identifier first, validates owner/admin/delegated authority, returns authorised editions and preferred edition data, and returns structured statuses for normal failure states.
