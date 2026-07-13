# Achievements Design

## Concepts

- **Achievement**: a permanent recognised accomplishment earned from authoritative gameplay.
- **Milestone**: a measurable threshold inside a progression sequence; not every milestone needs a public badge.
- **Career milestone**: a major music-career or professional accomplishment such as a first master, strong gig, mastery rank or teaching reputation threshold.
- **Challenge achievement**: a difficult achievement requiring preparation, compound conditions or constrained performance.
- **Hidden achievement**: an achievement whose exact conditions are concealed until earned or deliberately hinted.
- **Title**: a selectable profile label granted by an achievement; titles have no hidden power.
- **Badge**: a visual marker for profiles, band profiles, teaching/professional surfaces or the achievement cabinet.

## Canonical data model

The additive catalogue keeps legacy columns but introduces canonical fields: `slug`, constrained category/tier/type, activity flags, repeat policy, display order, icon key, points and balance version. Criteria move to `achievement_criteria` instead of JSON slug/UI logic. Rewards move to `achievement_rewards` with bounded reward kinds.

## Criteria model

Criteria support `all`, `any`, ordered sequences, cumulative thresholds, distinct entities, time windows, role scopes, band scopes and personal scopes through explicit columns plus metadata. Target keys refer to authoritative facts such as skill level, completed songs, final recording quality, completed gigs, audience response, mastery rank, distinct students, band goal contributors and longevity months.

## Event-driven evaluation

Server functions evaluate achievements from authoritative events only:

- `evaluate_achievements_for_event(event_id)` routes by event type and mapped criteria.
- `evaluate_achievements_for_profile(profile_id, context)` is for repair/backfill/admin diagnostics.
- `evaluate_achievement_progress(profile_id, achievement_id)` returns safe progress for UI.

Clients may read progress and request display changes, but may not submit completion or arbitrary progress.

## Tracks included

The initial catalogue covers onboarding, skills, attributes, role readiness, songwriting, recording, gigs, mastery, teaching, band contribution, professional credits, longevity and challenges. Chains are intentionally short, e.g. Working Musician I-III and role-development sequences.

## Rewards

Rewards are modest and bounded: titles, badges, small cash/XP/AP grants, professional/band reputation and convenience cosmetics. Reward settlement is idempotent and tied to earned ownership rows.

## Hidden achievements

Before completion, hidden achievements expose only `hidden_mode` and optional vague hints. Exact hidden criteria stay server-side and are blocked from public/client-safe views. Completion reveals the normal description unless the row remains deliberately secret.

## Profile, cabinet and roadmap

The achievements cabinet shows recent, completed, in-progress, hidden states, category/tier filters, rewards, titles, featured badges and nearby milestones. The Skills & Attributes hub consumes concise suggestions only; it is not a quest page.

## Retroactive evaluation

Backfill is conservative, idempotent and sourced from historical authoritative rows. It suppresses notification storms, does not infer unsupported criteria and does not backfill repeatable counts without verifiable source events.

## Anti-exploit controls

- RLS prevents client inserts/updates/deletes to earned achievement tables.
- Source event uniqueness blocks duplicate completion.
- Repeatable achievements require limits.
- Distinct-student and contributor criteria limit reciprocal farming.
- Cancelled/draft/preview activities are excluded by event metadata.
- Titles and featured badges require earned ownership.

## Follow-up career recognition work

Add richer producer, engineer, manager, venue/business and songwriter-for-hire chains as those profession systems gain durable credits and quality metrics.
