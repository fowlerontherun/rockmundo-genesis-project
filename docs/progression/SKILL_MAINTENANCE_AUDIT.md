# Skill Maintenance Audit

## Current storage
- Normal skill levels live in `player_skills` / `skill_progress` style rows with `current_level`, XP and `last_practiced_at` updates from progression, university, relationship and jam-session functions. The canonical catalogue is `CANONICAL_SKILLS` plus `skill_definitions` migrations.
- Mastery is separate from normal level through mastery metadata on canonical skills and the `20260712123000_add_skill_mastery_progression.sql` migration. It should remain permanent.
- Existing timestamps found: `last_practiced_at` is written by practice/progression functions; no reliable universal `last_used_at` exists.

## Activity proof available
Completed jam sessions, rehearsals, recording sessions, gigs, university attendance, book reading, relationship activities and progression handlers can prove use only when server-side completion, attendance, duration and role relevance are available. Page views, bookings, accepted invitations and cancelled sessions are not proof.

## Returning-player treatment
Wellness and career-longevity docs mention comeback/readiness concepts, but skill progression does not currently grant bounded skill sharpness recovery. Existing daily stipend and activity grants reward activity but are not a comeback mechanic.

## Scheduled infrastructure
Supabase Edge Functions already run cron-like jobs and log through `cron_job_runs` / shared job logger. Skill maintenance should not rely on a mass daily job; lazy calculation avoids touching every player skill daily.

## Calculators assuming full skill effectiveness
Songwriting utilities, recording bonuses/outcome calculators, gig song processing, stage skill bonuses, gear performance and producer quality use stored skill level as full current effectiveness. These are the integration points for a small sharpness modifier.

## Existing decay or expiry systems
There is an age-based `skillDecline` utility that broadly reduces skills and should not be reused for this feature. Equipment, wellness and relationship decay/maintenance concepts are separate and should not be conflated with skill sharpness.

## Risks
- Database: per-skill sharpness rows can grow; use lazy creation, profile/skill indexes and event idempotency instead of daily rows.
- Performance: preview paths must batch sharpness lookups and derive current values in memory.
- Exploits: duplicate completions, unrelated roles, cancelled sessions, short logout loops, role-focus switching and alternate profiles must not refresh or reset maintenance.
- Player confusion: skills page, recording/gig/songwriting previews, mastery panels, recommendations and admin diagnostics need explicit wording that levels and mastery ranks are permanent.

## Skills that should never rust
Starter, foundational, hidden, inactive, deprecated, low-level, basic literacy/social/wellness, and beginner role skills should not support maintenance. In the current canonical catalogue this excludes foundational guitar, vocals, drums, bass and songwriting; only non-foundational advanced/professional/specialist catalogue entries are eligible.
