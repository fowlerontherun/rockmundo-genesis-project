# Mastery design

## Model

Normal skill progression → mastery eligibility → one primary specialisation choice → mastery ranks → bounded perk/title/challenge unlocks.

- **Normal skill level**: the existing level up to the normal cap (`100`). It remains the functional competitiveness baseline.
- **Specialisation**: a path attached to a mastery-enabled skill, such as Live Guitar or Commercial Hooks. It defines role identity and system-specific effects.
- **Mastery rank**: a small long-term rank from 0-4: Eligible, Specialist, Expert, Master, Virtuoso.
- **Mastery XP**: a separate per-profile/per-specialisation currency awarded only by server-authoritative ledgers.
- **Mastery perks**: small effects such as consistency, recovery, teaching credibility or efficiency; they are not generic quality multipliers.
- **Prestige rewards**: leaderboards, professional visibility, invitations and credits.
- **Cosmetic recognition**: selected titles and badges such as Master Guitarist or Virtuoso Vocalist.

## Eligibility

Baseline eligibility is primary skill at max level, lifetime use/XP and one supporting requirement. Requirements are explicit metadata and prerequisites; hidden prerequisites remain hidden until discovery. Inactive skills and inactive specialisations cannot progress.

## Ranks and curves

Named curves are `mastery_standard`, `mastery_professional` and `mastery_elite`. Rank XP thresholds are intentionally steep and challenges gate each rank so passive XP alone is insufficient.

## XP sources and anti-grind rules

Eligible sources include gigs, recording, songwriting, teaching, challenges and conservative migration grants. Rewards use difficulty, quality, duration, relevance and repetition penalties. Trivial activity below difficulty/quality thresholds gives no mastery XP; repeated identical activity diminishes heavily.

## Perks and caps

Each rank usually grants about 1-2% specialised value. A full path should remain under 8-10% direct numerical advantage. Effects are keyed to a gameplay system, for example `live_gig:crowd_recovery` or `recording:retake_waste_reduction`; unrelated systems receive no benefit.

## Integrations

- Songwriting: structure consistency, accessibility contribution, realised potential and collaboration penalty reduction.
- Recording: role consistency, retake waste reduction, producer/engineer judgement and fatigue resistance.
- Gigs: recovery, endurance, crowd retention and technical reliability for configured stage roles only.
- Teaching: masters may run advanced lessons with bounded student benefit and bounded teacher rewards.

## Choice and respecialisation policy

Players choose one primary specialisation per skill initially. Additional paths can be a later unlock. Switching is allowed with a 70-80% XP retention band, cooldown and non-paid in-game cost. Historical achievements remain, but active perks are removed and recalculated from the new path.

## Migration policy

Existing normal levels and lifetime XP are preserved. Qualifying veterans can unlock eligibility and may receive a one-time verified post-cap activity grant capped below Rank 1. No one receives Rank 1+ based only on current skill level.

## Telemetry and diagnostics

Track eligibility, views, selections, XP awards, rank gains, challenges, perks, titles, respecialisation, teaching and blocked actions. Admin diagnostics expose read-only catalogue configuration, player records, recent ledgers, migration grants, balance versions, suspicious patterns and idempotency conflicts.

## Follow-up veteran progression work

- Tune thresholds using production telemetry.
- Add more specialisations only when their source activities are server-authoritative.
- Connect professional reputation to a marketplace redesign in a separate PR.
