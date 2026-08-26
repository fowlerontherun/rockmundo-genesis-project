# E1 — Tour HQ live Supabase integration

## Delivery

Tour HQ is now wired into the existing Tour Manager detail journey using a live, permission-checked Supabase projection instead of the orphaned simulation-only `buildTourHQ` path.

## Live authority

`get_tour_hq_live(uuid)` projects only canonical existing tour data:

- `tours`
- `tour_venues`
- `venues` / `cities`
- `gigs` / `gig_outcomes`
- `tour_travel_legs`
- `tour_logistics`

The RPC verifies that the caller is either the recorded tour owner or a member of the tour's band before returning private operational data. It is `SECURITY DEFINER`, has an explicit `search_path`, grants execute only to `authenticated`, and explicitly denies anonymous execution.

## Player experience

The existing tour details panel now includes Live Tour HQ for scheduled, active and completed tours. It shows current/next stop, canonical route progress, tickets sold, realised revenue, known tour costs, latest logistics condition, travel-leg progress and operational warnings. The UI includes loading, error, retry, manual refresh and one-minute refresh behaviour.

## Verification

A live scheduled production tour was projected successfully with 16 routed stops, 15 travel legs and 141 already-sold tickets. The projection returned canonical upcoming venue/city information and costs without creating or modifying gameplay data.

No migration file is included; the database change was applied directly to the live RockMundo Supabase project as required.
