# Songwriting Skills Audit

## Current project creation flow

`useSongwritingData.createProject` inserts directly into `songwriting_projects` from the client with title, theme, chord progression, initial lyrics, creative brief, genre, purpose, mode, instruments, zeroed progress and `estimated_sessions = 3`. The client also sets `quality_score = 0`, `song_rating = null`, and lock fields. This means creation is convenient but not server-authoritative beyond RLS.

## Current session flow

Before this PR, `startSession` ran mostly client-side: it counted locked projects, hard-coded a one-hour lock, updated the project, inserted `songwriting_sessions`, and then best-effort inserted `player_scheduled_activities`. Activity insertion failure did not stop the session. The UI offered two- and four-hour effort options, but the session lock was fixed at one hour.

This PR moves session start to `start_songwriting_session`, validates profile ownership, project state, supported durations, and schedule overlaps, and stores the selected duration.

## Current progress calculation

Previous client completion accepted optional client-provided `skillLevels` and `attributes`. If present, it read only `songwriting_basic_composing` and `songwriting_basic_lyrics`; otherwise it generated random 500-999 music and lyrics progress. The database also contains several historical `auto_complete_songwriting_sessions` implementations with different formulas, including fixed progress ranges, random quality, and partially incompatible column assumptions.

Concrete legacy examples:

- Client fallback session: `musicGain = random(500..999)`, `lyricsGain = random(500..999)`, `xp = floor((musicGain + lyricsGain) / 10)`.
- Client skill session: `baseProgress = 400..599`; composing and lyric slugs multiply music and lyric progress independently.
- Auto-complete migrations used evolving formulas and sometimes converted projects automatically when both tracks reached completion.

Because multiple formulas existed in different places, a single current quality path could not be traced reliably for every project.

## Current quality calculation

`src/utils/songQuality.ts` produced client-side final quality from component strengths, wide luck, genre multiplier, skill ceiling, experience and session-depth bonuses. The conversion hook accepted a `quality` object from the client and inserted song scores from it. That made final song quality client-authoritative and rerollable from the UI path.

## Skills found

Relevant canonical skills include `songwriting`, `composition`, `technical`, `vocals`, `guitar`, `bass`, and `drums`. Extended catalogues also include namespaced genre skills such as `genres_basic_rock`, `genres_professional_rock`, and `genres_mastery_rock`, plus older songwriting tier slugs used by legacy UI formulas.

## Attributes claimed to affect songwriting

The code and docs reference `creative_insight`, `musical_ability`, `technical_mastery`, `musicality`, `mental_focus`, `rhythm_sense`, and `vocal_talent`. Legacy client code only used a subset (`creative_insight`, `musical_ability`, `technical_mastery`) and did not cap total attribute influence relative to skills.

## Genre-skill usage

Genre selection is visible in the UI and `getGenreSkillSlug` maps genres to tiered skill slugs. Legacy quality used genre skill as a flat multiplier up to 1.5x. This PR changes genre knowledge into bounded authenticity and mismatch handling in the server breakdown.

## Collaborator handling

Forward migrations added collaborator and session contributor tables. The stable UI path mostly stored selected co-writer names in form state and did not authoritatively validate accepted collaborators. Invited or unaccepted collaborators were not consistently excluded by calculation. This PR lays the server-authoritative breakdown and validation path; richer accepted collaborator shares remain constrained by existing collaborator records.

## Authorship and ownership

Legacy conversion silently assigned `original_writer_id` and personal ownership to the active profile unless a band ID was passed, with band ownership inserted as 100% for the creator. This is risky for co-authored songs. The new completion RPC is idempotent and stores calculation version and project link; follow-up work should wire all accepted collaborator split records into `song_contributors`/ownership tables where production schemas are stable.

## Randomness

Legacy randomness used `Math.random()` in the browser for progress, component variance and luck. It was wide enough to override preparation. This PR uses server-generated or stored seeds for final quality and bounded variance.

## XP rewards

Legacy XP was derived from generated progress and client completion. This PR returns server-calculated role-relevant XP awards in the session result and stores them in `xp_awards`. A follow-up should route each award through the shared progression ledger RPC where all production grant hooks are available.

## Lock and duration behaviour

The UI exposed multi-hour effort, but sessions locked one hour. Two simultaneous songwriting locks were allowed even though schedule conflicts should prevent overlapping active time. The new start RPC supports 1, 2 and 4 hours and rejects overlapping scheduled activities.

## Duplicated/conflicting formulas

- Client `completeSession` progress formula.
- Client `calculateSongQuality` final score formula.
- Multiple historical `auto_complete_songwriting_sessions` functions.
- Trigger-based `create_song_from_completed_project` paths.

## Client-authoritative calculations

The client previously submitted progress, final quality object fields, and effectively controlled XP through completion inputs. This PR removes those trusted inputs from the main hooks.

## Unused or risky columns

`estimated_sessions`, `effort_hours`, `song_rating`, `quality_score`, dimension quality columns and collaborator tables were not consistently populated or used. Legacy `quality_score` uses both 0-100 and 0-1000 semantics in different places; `song_rating` is retained as 0-1000.

## Known bugs and assumptions

- Existing completed songs are not rerolled.
- Legacy incomplete projects get safe default breakdown values as future sessions complete.
- Collaboration tables exist but require further production data review before automatic royalty split writes are expanded.

## Follow-up recording and performance integrations

Recording, studio engineer, live gig, streaming and chart formulas are intentionally not changed here. They should consume the stored songwriting score and breakdown later rather than reimplement songwriting quality.
