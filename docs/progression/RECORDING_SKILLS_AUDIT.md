# Recording Skills Audit

## Current studio discovery and booking flow

Studio booking is documented as a city-bound flow where players filter studios by city, inspect `quality`, `engineer_rating`, `equipment_rating`, `cost_per_day`, and select morning/evening daily slots. The schema created by `20270630100000_create_studio_infrastructure.sql` contains `studio_bookings`, slots, artists and songs, but the active auto-completion path still reads directly from `recording_sessions` and `city_studios`.

## Current recording setup flow

The UI and hooks create `recording_sessions` for completed songs. The cron/Edge completion worker finds sessions with `status = 'in_progress'` and `scheduled_end < now()`, then mutates the session and song. Recording versions (`standard`, `remix`, `acoustic`) are handled in completion: non-standard versions create or update a child song; standard recordings update the source song.

## Attendance rules

Before this PR, completion inferred attendance from active band membership and city presence. It checked active non-touring members' active profiles against the studio city and failed the session if any were elsewhere. It did not require explicit recording invitations, accepted attendance, role assignments, or session-musician contract acceptance.

## Current quality calculation

The legacy Edge Function used this opaque path:

1. `currentQuality = songs.quality_score || 50`.
2. `studioQualityBonus = city_studios.quality_rating * 2` when a studio was attached.
3. Random session luck selected severe penalties or large boosts:
   - technical issues: `0.4–0.7x`;
   - rough session: `0.7–0.9x`;
   - great flow: `1.2–1.5x`;
   - magic take: `1.6–2.0x`.
4. Band morale, reputation and sentiment multiplied the improvement.
5. `baseImprovement = floor(durationHours * random(1..12))`.
6. `qualityImprovement = min(40, floor(baseImprovement * luck * morale * reputation * sentiment) + studioQualityBonus)`.
7. `newQuality = min(100, currentQuality + qualityImprovement)`.

Concrete example: a 24-hour booking in a `quality_rating = 5` studio could roll `baseImprovement` anywhere from 24 to 287 before modifiers, add a flat `+10` studio bonus, cap the improvement at `40`, and directly overwrite the song quality. A `magic_take` could therefore dominate preparation, while a strong song was always improved rather than potentially captured poorly.

## Current use of song quality

The song's `quality_score` was both source-material quality and the mutable recorded quality. Standard recording overwrote the song with `newQuality`, so the system could not reliably distinguish songwriting quality from master quality.

## Current use of studio quality

Only `city_studios.quality_rating` was used in completion, as a flat `quality_rating * 2` additive bonus. Documented studio `engineer_rating` and `equipment_rating` were not part of the active completion formula.

## Current use of engineers and producers

The legacy completion path stored nullable `producer_id` and `player_producer_id`, and documentation described producer selection, but completion did not fetch producer skills, production skill, genre fit, or player-producer attributes. Engineer capability was not used except as a documented studio field.

## Current use of equipment

Equipment items contain effects such as `recording_quality` and `mix_quality`, and studios document equipment ratings. The active completion path did not use player equipment, studio equipment, equipment condition, suitability, or microphone/booth quality.

## Current use of player skills and attributes

The active completion path did not fetch role skills, canonical skill-role links, attributes, genre knowledge, health, energy, focus, or wellness modifiers. XP was awarded as one generic performance action with a client-independent amount derived from duration and quality improvement, but it was not role-specific.

## Current session musician behaviour

Studio booking tables include an artist role of `session_musician`, and there are session-musician references in migrations and docs, but the completion worker did not validate contracts or use them for role coverage. If a band member was missing, the session failed rather than using a contracted substitute.

## Current recording duration rules

Documentation describes daily studio slots and multi-day bookings, while the completion worker computes `durationHours` from `scheduled_start` and `scheduled_end`. The legacy formula scaled linearly with hours before a hard improvement cap, so long sessions could hit the cap quickly and did not have controlled diminishing returns.

## Current scheduling and locking behaviour

The completion worker queries eligible rows and updates them after calculation. It did not atomically lock each session row before calculating, and randomness was generated with `Math.random()`, so a retry before status mutation could reroll. Booking-slot RLS and unique indexes exist in studio infrastructure, but the recording completion calculation itself was not a single database transaction.

## Current XP rewards

The legacy worker calculated `xpEarned = floor(15 * durationHours * (1 + qualityImprovement / 50))` and invoked the progression function with `category: 'performance'` and `action_key: 'recording_session'`. It did not award instrument, vocal, production, or engineering XP based on actual role contribution.

## Duplicate or conflicting formulas

- `docs/studio-booking.md` describes `BaseEfficiency * BandSkillScore * ProducerFactor * MoodModifier * Momentum`.
- The Edge Function used duration, random luck, morale, reputation, sentiment and flat studio quality.
- Equipment migrations define `recording_quality` and `mix_quality` effects, but completion ignored them.
- Studio infrastructure documents daily slots, while completion accepts arbitrary hour spans.

## Client-authoritative calculations

The active completion worker is server-side, but setup data is incomplete. Clients could still influence outcomes indirectly by creating sessions with long durations or fields that the server did not fully validate in the completion path. The client did not submit final quality in the audited worker.

## Unused database columns

The active calculation did not use several recording-relevant columns and concepts found in schema/docs: `engineer_rating`, `equipment_rating`, `studio_booking_artists.role`, producer/player-producer capability, session mood/mode beyond storage, player equipment effects, song familiarity, rehearsal readiness, and explicit credits.

## Known bugs and risky assumptions

- The worker contained a duplicate `let targetSongId = session.song_id` declaration in the remix/acoustic branch.
- `Math.random()` made outcomes non-idempotent until the row update succeeded.
- Strong source songs could only improve; there was no bad-recording outcome for strong songs.
- Studio quality was an oversized flat additive bonus.
- Missing roles were not modeled; only city absence could fail a band session.
- Active members were treated as participants without explicit accepted recording attendance.
- XP was generic and unrelated to roles.
- The result could not be traced to performer, producer, engineer, equipment or readiness inputs.

## Follow-up live performance and commercial outcome work

Live gig performance, streaming success, chart success, ticket sales, release marketing and commercial outcome models remain intentionally out of scope. The recording model should become an input to those future systems without copying their calculations into recording completion.
