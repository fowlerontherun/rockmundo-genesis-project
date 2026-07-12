# Live gig audience participation and social viewing

This phase extends the server-driven live gig system with an audience layer. The existing live session, live segment, song result, incident, decision and replay architecture remains authoritative; audience actions create social atmosphere and modest capped modifiers only.

## Architecture inspected

- Live sessions are stored in `gig_live_sessions`, with immutable segment ordering in `gig_live_segments`, per-song authoritative results in `gig_live_song_results`, incident/decision tables and service-role lifecycle RPCs.
- Live presentation currently uses `RealtimeGigViewer`, `GigViewerShell` and the gig experience DTOs to show public-facing show progress while the band-manager pages keep tactical decisions separate.
- Ticketing for normal gigs is mostly aggregate (`gigs.tickets_sold` plus venue capacity); festivals already have `festival_tickets` and `festival_attendance`.
- Visibility, memberships and social relationships are represented through band membership/manager guards, profile privacy settings, friendships, notifications, Twaater/community feed tables and RLS policies.
- Location validation is city-level through `profiles.current_city_id` and `venues.city_id`; exact venue room/location attendance is not currently available.
- Existing anti-abuse conventions prefer RLS denial for direct writes, SECURITY DEFINER RPCs, unique constraints, idempotency keys and bounded counters.

## Eligibility and attending versus viewing

`check_in_gig_audience` accepts server-side attendance types for ticket holders, invited/VIP guests, band friends, venue staff, crew, support acts, festival attendees, remote viewers and admin viewers. Physical attendance requires an authenticated profile, a non-terminal gig, venue capacity, and city-level location match where a venue city exists. Remote viewing creates a record but does not consume capacity or receive attendance rewards.

Current limitation: normal gig tickets are aggregate in the existing schema, so the first implementation can store a nullable `ticket_id` but cannot verify an individual normal-gig ticket table that does not yet exist. Festival ticket ownership and richer invitation checks are extension points for future PRs.

## Attendance records and presence

`gig_audience_attendance` stores one row per player per gig with attendance type, status, ticket/invitation references, check-in time, last presence, watch duration, participation score and reward status. Rejoins update the existing row and preserve cooldown/reward state. Brief reconnects are tolerated by using bounded presence timestamps rather than high-frequency heartbeats.

## Capacity and finances

Real player check-ins are treated as a subset of existing sold/expected attendance. The RPC caps physical check-ins at `LEAST(gigs.tickets_sold, venues.capacity)` when sold tickets exist, or venue capacity as a fallback. Remote viewers and admins do not consume capacity. No ticket revenue or financial result is changed by audience check-in.

## Audience view model

Audience UI uses `LiveGigAudiencePanel` inside the live viewer. It displays public stage context, aggregate participation level, active participants, encore demand, capped atmosphere modifier, attendance status, reaction cooldown and reward progress. Private band readiness, crew details, health, finances, hidden probabilities, admin diagnostics and tactical options are not exposed by this panel.

## Reactions, timing and limits

Allowed reactions are positive/neutral: cheer, clap, sing along, hands up, dance, phone wave, chant, encore request, support performer and highlight. Timing is tied to the authoritative current live segment; client-provided current segment/timestamps are not trusted. Limits are one reaction every 4 seconds, 6 per segment/song, 40 per gig and one encore request per gig, with idempotency-key duplicate suppression.

## Aggregation and influence

`gig_audience_segment_aggregates` stores compact segment snapshots: reaction counts, unique participants, participation score/level, encore demand, singalong strength and an audience modifier. The client utility weights unique attendees, reaction variety and correct timing instead of raw reaction count. Influence is capped at +4 per segment and is intended to translate to at most +3 crowd energy/atmosphere and +2 support recovery. It cannot override curfew, stamina, preparation failure, invalid setlists or authoritative live decisions.

## Requests, encore, polls and ratings

Encore requests are aggregated as reaction data and may be surfaced as modest encore demand; they do not force an encore. `gig_audience_polls` and `gig_audience_poll_votes` support system/authorised predefined polls with one vote per attendance. `gig_audience_ratings` supports one structured post-gig rating per completed physical attendance, with favourite song and standout performer references for report aggregation.

## Rewards

`process_gig_audience_rewards` is service-role only and idempotent by attendance. It grants modest fan/social progression snapshots based on participation score to completed physical attendees only. Remote viewers, admin viewers, cancelled/removed rows and already processed rows receive no attendance reward.

## Friend presence, social integration, moderation and privacy

The first UI exposes aggregate presence only. Identity-level friend presence should be added by joining accepted friendships, profile privacy settings, blocking and mute/report tables before showing avatars. Predefined reactions avoid unrestricted public chat. RLS denies direct client writes; muting/removal can set attendance status to `removed` or add moderation snapshots without creating a separate moderation system.

## Realtime and retention

Realtime subscriptions listen to compact aggregate and attendance updates. Individual reaction events are persisted for audit/rate-limit windows but UI renders aggregate state only. Retention policy: preserve final attendance, reward, rating, poll vote and aggregate rows; raw reactions may be pruned after abuse-investigation windows once final aggregates are settled; low-value presence timestamps should not be expanded into indefinite heartbeat logs.

## Spectator extension points

The schema separates attendee, remote viewer, band-manager and admin concepts, keeps public presentation endpoints read-only, and uses aggregate broadcasts so festivals/large broadcasts can scale later without replacing the live gig simulation.
