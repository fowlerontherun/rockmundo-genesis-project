# Gig preparation readiness

This phase adds gig-specific setlists and an explainable readiness score for upcoming performances.

## Data model

- `gig_setlists`: one persisted preparation setlist per scheduled gig, owned by `gig_id` and `band_id`, with cached `total_duration_seconds`.
- `gig_setlist_items`: ordered setlist rows with `song_id`, `position`, and `is_encore`.
- `gig_outcomes`: stores `readiness_score`, `readiness_modifier`, and `readiness_breakdown` so completed gigs can explain how preparation affected the result.

## Validation rules

Blocking errors prevent saving or resolving a gig:

- Empty setlist.
- Duplicate songs in the same setlist.
- Songs not owned by the performing band.
- Missing song duration.
- Encore songs before normal-set songs.
- Edits by users who are not band leaders or managers.
- Edits to completed or cancelled gigs.

Warnings do not block saving:

- Total duration shorter than 85% of the booked slot.
- Total duration longer than 108% of the booked slot.

## Readiness calculation

Readiness is a weighted 0–100 score:

- Setlist completeness: 24%.
- Booked slot duration fit: 14%.
- Song familiarity/rehearsal: 18%.
- Recent rehearsal: 14%.
- Recent jam session: 8%.
- Band chemistry: 10%.
- Fatigue and health: 6%.
- Required performers: 6%.

Missing optional data falls back to neutral scores so historical and incomplete gigs remain readable.

## Ratings

- 0–29: poor.
- 30–49: average.
- 50–69: good.
- 70–89: excellent.
- 90–100: legendary.

## Outcome impact

Readiness applies a bounded modifier during gig execution. Scores above 70 can add up to +6%; low readiness can penalize by up to -10%. The modifier is intentionally modest so songs, rehearsal, chemistry, equipment, crew, performers, venue, weather, fatigue, and randomness remain meaningful.

## Extension points

Future crew, equipment, soundcheck, and stage setup systems should contribute additional readiness factors through the central readiness input rather than duplicating formulas in UI components or execution code.
