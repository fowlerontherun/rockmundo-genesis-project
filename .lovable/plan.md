

# Teaching Skill Tree & Player-to-Player Teaching System (v1.0.924)

## Overview
Add a "Teaching" skill tree that unlocks the ability to teach any skill you have to a friend, awarding more XP/day than university courses (university caps at ~95 XP/day, teaching will grant 50-120 XP/day to the student, plus 30-60 XP/day to the teacher).

## 1. Skill Tree Definitions (src/data/skillTree.ts)

Add a new `teachingConfigs` array with 3 tiers:
- **Basic Teaching** — Unlocks peer teaching for skills you have at level 5+. Student gets 50-80 XP/day.
- **Professional Teaching** — Teach skills at level 3+, student gets 70-100 XP/day, teacher gets more XP.
- **Mastery Teaching** — Teach any skill at level 1+, student gets 90-120 XP/day, unlocks group teaching (2 students).

Include in the build export array.

## 2. Database — New Tables (migration)

**`player_teaching_sessions`** table:
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| teacher_profile_id | uuid FK profiles | |
| student_profile_id | uuid FK profiles | |
| skill_slug | text | Skill being taught |
| status | text | scheduled, in_progress, completed, cancelled |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| teacher_xp_earned | int | 30-60 XP/day |
| student_xp_earned | int | 50-120 XP/day |
| session_duration_days | int | 1-7 day sessions |
| created_at | timestamptz | |

RLS: Players can read/write their own sessions (as teacher or student). Friendship validation done in application code.

**Seed `skill_definitions`** with the 3 teaching slugs for FK integrity.

## 3. Teaching Hook (src/hooks/useTeaching.ts)

New hook providing:
- `canTeach(skillSlug)` — checks teacher has the teaching skill unlocked + adequate level in the target skill
- `getTeachableSkills()` — lists skills the player can teach
- `getFriendsWhoCanLearn(skillSlug)` — queries accepted friendships, filters students who don't already exceed the teacher
- `startTeachingSession(studentProfileId, skillSlug, durationDays)` — creates session, validates friendship
- `activeTeachingSessions` — current sessions as teacher and student
- XP calculation: scales with teacher's teaching skill tier and target skill level

## 4. Teaching Page (src/pages/Teaching.tsx)

New page at `/teaching` with:
- **Teach tab**: Shows teachable skills, select a friend, start a session (1-7 days)
- **Learn tab**: Shows incoming teaching offers / active sessions where player is student
- **History tab**: Past sessions with XP earned

Wrapped in `SkillSystemProvider`.

## 5. XP Processing

Teaching sessions award XP daily (like university attendance). The XP rates intentionally exceed university:
- University: 15-95 XP/day
- Teaching Basic: 50-80 XP/day (student) + 30-40 XP/day (teacher)
- Teaching Professional: 70-100 XP/day (student) + 40-50 XP/day (teacher)
- Teaching Mastery: 90-120 XP/day (student) + 50-60 XP/day (teacher)

A `processTeachingSessions` utility function will handle daily XP awards for active sessions.

## 6. Integration

- Add route `/teaching` in `App.tsx`
- Add "Teaching" nav entry under Education in `navigation.tsx` and `HorizontalNavigation.tsx`
- Add to `ScheduleActivityDialog.tsx` as a schedulable activity
- Add i18n keys for en/es/tr
- Register teaching skill slugs in seed migration

## 7. Versioning

- Bump to **v1.0.924**
- Update `VersionHistory.tsx`

