# Achievements Audit

## Existing implementations

The current achievement layer is fragmented:

1. `public.achievements` is the original JSON catalogue. It stores `name`, `description`, `category`, `icon`, `rarity`, `requirements` and `rewards`.
2. `public.player_achievements` stores earned rows. It began as user-scoped (`user_id`, `achievement_id`, `unlocked_at`, `progress`) and later gained `profile_id`.
3. Several seed migrations insert achievements directly with free-form JSON requirements and rewards.
4. New-user triggers grant `First Steps` by inserting directly into `player_achievements`.
5. Client hooks and profile/statistics components read achievements directly for profile display.
6. Leaderboard summary views count earned achievements.
7. A later migration adds an achievement-unlock XP trigger, creating economy risk because every insert can grant a fixed reward.

## Tables and views found

- `achievements`: catalogue, free-form requirements and rewards.
- `player_achievements`: earned rows, historically user-scoped with one row per user/achievement.
- `player_achievement_summary`: summary view for total, earned and remaining achievements.
- Leaderboard views include total achievements as an aggregate field.

## Current badges and titles

No canonical earned-title or earned-badge ownership table was found for achievements. UI uses generic badge components visually, but not durable achievement-backed profile badges. Titles exist as text in unrelated systems and profile/UI labels, not as achievement-owned selectable profile titles.

## Completion authority

Completion is mixed and often not server-authoritative:

- New profile creation server functions insert `First Steps` directly.
- Some activity systems update stats or call reward utilities from client code.
- Existing `player_achievements` RLS includes a policy allowing users to manage their own achievements, which permits direct client-side completion attempts.
- JSON `requirements` are not tied to a canonical evaluator, so completion semantics are not reliable.

## Current rewards

Rewards are free-form JSON. Examples include cash, fame, skill points and XP. Several historical achievements grant very large amounts, including legendary and mythic cash/fame/skill-point rewards, which conflicts with bounded progression goals.

## Examples from trigger to reward

- **First Steps**: profile creation trigger inserts into `player_achievements`; any insert can trigger unlock XP if the global unlock-XP trigger exists. This is server-side but duplicated across migrations.
- **Stage Veteran**: catalogue requirement is `{"gigs_played": 25}` and reward is cash/fame JSON. No canonical event mapping proves which gig rows qualify.
- **Songsmith**: requirement is `{"songs_written": 25}`. Draft/trivial song protection is not encoded.
- **Mentor**: requirement is `{"students_mentored": 5}`. Distinct-student and reciprocal-farming rules are not explicit.
- **Chart Topper**: seeded by chart migration. Completion depends on chart code paths rather than shared criteria.

## Duplicate and overlapping achievements

- Several migrations insert the same or similar achievements (`Stage Veteran`) with different requirements/rewards.
- `First Steps` is referenced by multiple profile creation/reset migrations.
- Gig, regional and chart chains overlap with fame-heavy rewards without shared chain metadata.

## Unreachable and trivial achievements

- Achievements with `{"manual": true}` have no visible evaluator path.
- JSON keys such as `year_end_one`, `country_number_ones` or `sold_out_streak` may be unreachable if no authoritative event writes those stats.
- `First Steps` is trivial and currently duplicated by reset paths unless protected by idempotency/user-level constraints.

## Hidden achievements

No canonical hidden state, hint state, or secret-criteria protection was found. Existing rows are fully selectable from the client, including requirements JSON.

## Profile display and notifications

Profile/statistics pages display unlocked and locked achievements by reading `achievements` and `player_achievements`. Realtime notifications listen for inserts into `player_achievements`. There is no batching for backfill or noisy progress changes.

## Leaderboards

Leaderboards include total achievement counts. This rewards raw quantity and does not distinguish trivial achievements from prestigious ones.

## Migration risks

- Existing clients expect `name`, `description`, `category`, `icon`, `rarity`, `requirements` and `rewards`.
- Existing earned rows use `user_id`; newer code prefers `profile_id`.
- Removing legacy columns would break UI, so the canonical model must be additive.
- RLS must stop direct client inserts/updates without blocking reads.

## Known bugs and exploits

- Direct client achievement completion is possible under the historical manage-own policy.
- Duplicate source events are not represented, so repeated processing can award again through ad hoc code.
- Repeatable achievements have no repeat limits.
- Reset functions delete achievements, allowing onboarding/fixed unlock rewards to be re-earned.
- Free-form rewards include excessive power/economy grants.
- Hidden criteria are client-visible.

## Progression gaps

There is no unified coverage for role readiness, mastery, teaching outcomes, band contributor milestones, recording master quality, long-term participation or professional credits. Existing achievements skew toward simple totals, chart/fame/economy thresholds and social counters.

## Follow-up career recognition work

Future work should migrate existing high-cash/high-skill-point rewards to cosmetic recognition, add profession-specific credits as each profession becomes authoritative, and convert manual/chart/regional achievements to explicit criteria when their event streams are stable.
