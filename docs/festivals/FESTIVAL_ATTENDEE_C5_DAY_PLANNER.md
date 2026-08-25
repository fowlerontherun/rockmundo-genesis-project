# Festival attendee C5 — My Day and stage schedule

## Status

Programme C / C5 complete.

## Player experience

While an attendee is checked in, Festival Mode now exposes a **Stages** section alongside **My Day**.

- **Stages** reads the Festival's published or locked canonical performance timetable. The player can browse each Festival day, see real artists/stages/times, preview whether a performance fits their current plan, and add it to My Day.
- **My Day** remains the persisted personal itinerary. Manual blocks cover food, drink, exploring, rest, campsite time, VIP time, vendors/merch and free time.
- Campsite and VIP options are only exposed when the attendee's admission product grants those entitlements, and the server re-checks the entitlement at preview/commit time.
- Before a manual block or performance can be committed, the server evaluates direct overlap and movement time to the previous/next planned location.
- The preview explains blockers and walking-time/trade-off warnings before the player commits.

## Authority model

C5 does not create a second Festival timetable.

The attendee's modern `festival_editions_v2` edition is bridged through the existing public legacy mapping to the existing authoritative Festival scheduling domain. `get_my_festival_stage_schedule` projects only `performance_slot` items from the current `published` or `locked` schedule revision that are marked `public_visible`.

The browser never writes `festival_schedule_items`, `festival_stages` or `festival_attendee_plan_items` directly. All player planning reads, previews and mutations use narrow authenticated RPCs.

## Feasibility and persistence

`festival_attendee_plan_items` remains the persisted server-owned My Day authority. C5 enriches each row with:

- source (`manual` or `stage_schedule`);
- canonical schedule/stage references where applicable;
- location key/label;
- derived walking allowance to neighbouring planned blocks.

Movement is deliberately simple and deterministic for this phase: same-location movement is free; general area movement has a small allowance; stage transfers require more time; campsite transfers require the largest allowance. These values are authoritative feasibility rules, not cosmetic UI hints.

Manual and canonical performance commits preserve the planner's existing replay/idempotency locks and also serialize per attendee/day. The exact feasibility check shown in preview is re-run under that day lock immediately before insert, so concurrent tabs cannot turn a previously feasible plan into an overlapping or impossible one.

Plan rows remain historical: missed/completed/cancelled entries are retained rather than deleted. Reconnects rehydrate My Day from the server and the canonical timetable projection re-derives which performances are already planned.

## Deliberate boundaries

C5 only owns planning and feasibility. It does **not** add:

- new XP/AP/reward authority;
- Festival finance or vendor settlement;
- social/random event resolution;
- new condition effects for campsite, VIP, vendor or free-time blocks.

The existing bounded condition resolver continues to execute Eat, Drink, Explore and Rest during their planned windows. C6 can build additional temporary Festival condition effects on top of the C5 timetable without changing scheduling authority.

## Acceptance mapping

- **Player can build a feasible Festival day:** manual practical blocks and canonical performances can be combined in one persisted timeline.
- **Overlaps are blocked or explicitly resolved:** direct overlaps and insufficient movement gaps are server blockers surfaced during preview and revalidated at commit.
- **Planner persists across reconnects:** My Day is a server projection from `festival_attendee_plan_items`; stage selections are linked to canonical schedule item IDs and rehydrated as already planned.
