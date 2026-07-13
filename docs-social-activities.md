# Social activities foundation

Social activities are scheduled hangouts outside formal music work. The balancing source of truth is `social_activity_catalog` and the matching TypeScript catalogue in `src/features/social-activities/catalog.ts`.

## Lifecycle

Activities move through draft/inviting/scheduled/confirmed/in-progress/completed/cancelled/failed/expired states. Accepted participants receive `player_scheduled_activities` blocks with `activity_type = social_activity`; pending invitees are not blocked until they accept.

## Payments and cancellation

Payment models are host, split, each-own, band, company-later and free. This foundation estimates participant shares at invitation time and records actual cost on completion. Cancelled activities are not charged by default.

## Effects and anti-farming

Completion is server-authoritative and idempotent through `complete_social_activity`. Outcomes create relationship events through `record_relationship_event` rather than mutating relationship fields directly. Group scaling, weekly repetition multipliers, catalogue cooldowns and the relationship event idempotency key prevent passive farming.

## Privacy

Detailed activity rows are visible to the host, participants and authorised band members only. Public memories should use broad summaries and must not include exact costs, private notes, conflict details, wellness state, attendance failures, moderation information or exact relationship values.
