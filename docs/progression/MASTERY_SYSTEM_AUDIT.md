# Mastery system audit

## Findings

- Normal canonical skills use `max_level: 100`; `getXpRequiredForNextLevel` returns `0` at cap and progress display should treat capped skills as complete rather than showing another normal level.
- Existing catalogue already has advanced and hidden content (`tier: "mastery"`, `skill_type: "mastery"`, hidden skill flags and slugs containing `mastery`), but those are normal skills, not a separate post-cap progression layer.
- Post-cap lifetime XP is preserved by lifetime-XP helpers, while level calculation clamps at max level. Systems that only inspect `xp_required_for_next_level === 0` can assume no normal next level exists.
- `player_skills` and `skill_progress` coexist; legacy wide `player_skills` columns are visible in older migrations, while normalized `skill_progress` is used by newer UI and progression code.
- Teaching exists as a relationship UI and education route, but repository evidence shows limited first-class mentor safeguards. The wellness career-longevity docs require no self-mentoring, pair caps, diminishing returns and idempotent completion.
- Achievements and profile badges exist, but mastery titles/badges are not currently canonical or selectable.
- Role mappings exist in the canonical catalogue through skill-role links and are used on the Skills page for readiness and recommendations.
- Veteran progression currently consists of high normal levels, advanced skills, education, career/legacy concepts and social prestige; it does not provide a bounded post-cap mastery ledger.
- Retirement and legacy are documented as optional prestige/lifecycle systems, not forced resets or broad skill decay.

## Exploit and migration concerns

- Repeated low-value activity could farm post-cap rewards unless mastery XP uses difficulty, quality, repetition penalties and idempotency keys.
- Client-side reward submission would be unsafe; clients may only request actions, while server code calculates mastery XP/ranks/challenge progress.
- Existing max-level players should not receive high ranks automatically because historical usage is incomplete and migration order could become an advantage.
- Hidden specialisations must not leak through public catalogue queries or RLS policies.
- Respecialisation must be atomic and must not duplicate titles, perks or ledger rewards.
- Teaching loops need pair cooldowns, unique-student limits, related-account checks where available and diminishing returns.

## Skills appropriate for mastery in this PR

Start with a small set that is already integrated with songwriting, recording and gigs:

- Guitar: Live Guitar and Studio Guitar.
- Vocals: Frontperson and Studio Vocals.
- Songwriting: Composition and Commercial Hooks.
- Production: Mixing plus one hidden experimental path for future unlocks.

Not every skill should support mastery initially. Beginner, deprecated, hidden-only, narrow prerequisite and low-impact support skills should remain normally capped until their gameplay loop has enough authoritative events.

## Systems that assume max-level XP is zero

- Normal progress bars rely on `xp_required_for_next_level` being `0` at max.
- Practice, education and display helpers should keep normal levels stable at `max_level` and route eligible veteran activity into the separate mastery ledger instead of extending normal levels.

## Follow-up veteran progression work

- Expand mastery only after event quality and anti-grind telemetry are proven.
- Add privacy-safe public service listings for mastered producers, engineers and teachers.
- Connect mastery titles to broader legacy and Hall-of-Fame surfaces without making retirement mandatory.
