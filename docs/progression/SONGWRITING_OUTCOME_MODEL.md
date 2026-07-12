# Songwriting Outcome Model

Balance version: `songwriting_progression_v2`.

## Separate concepts

- **Project completion**: music and lyrics progress toward 2000 each. Incomplete projects cannot be converted.
- **Session progress**: server-calculated progress gains for music, lyrics, arrangement, polish, consistency and insight.
- **Song potential**: theoretical ceiling from craft, attributes, genre knowledge, project choices, collaboration and bounded variance.
- **Final songwriting quality**: realised 0-1000 score after completion, polish and consistency factors.
- **Consistency**: reduces wasted work and narrows variance.
- **Polish**: post-completion refinement with a cap and diminishing returns.
- **Originality**: increased by experimental choices and harder structures, with more variance.
- **Commercial accessibility**: improved by commercial mode and familiar choices, with lower variance and lower extreme originality.
- **Genre authenticity**: bounded genre-specific familiarity; low knowledge creates mismatch risk, high knowledge gives a modest bonus.
- **Collaboration quality**: accepted, attending contributors add complementary support with diminishing returns and coordination penalties.

## Session progress formula

`base progress × duration modifier × skill efficiency × focus/health modifier × attribute learning modifier × collaboration modifier × project difficulty modifier × repetition modifier`

Duration modifiers are:

- 1 hour: `1.00`
- 2 hours: `1.90`
- 4 hours: `3.40`

Skills are the primary input. Attribute efficiency is intentionally capped so high attributes with weak skills cannot outperform a skilled writer consistently.

## Skill weights

For balanced/music sessions and potential:

- Songwriting: 34%
- Composition: 24%
- Technical/arrangement support: 10%
- Relevant genre knowledge: 17%
- Best practical instrument/vocal skill: 15%

Lyric-focused sessions shift weight toward songwriting, vocal interpretation and genre familiarity. Arrangement/polish sessions shift weight toward composition and technical skill.

## Attribute weights

Attributes contribute approximately 20% of final potential:

- Creative Insight: 22-30% of the attribute slice
- Musical Ability: 20%
- Musicality: 18%
- Mental Focus: 16%
- Rhythm Sense: 8%
- Vocal Talent: 3-6%
- Technical Mastery: 5-15% depending on arrangement/polish focus

## Genre handling

Primary and secondary genres average relevant `genres_basic_*` skill values. Low genre knowledge is bounded rather than catastrophic. High genre knowledge improves authenticity and consistency but does not act as a large flat multiplier.

## Project-choice trade-offs

- Difficult chord progressions: higher potential, slower progress, greater consistency risk.
- Familiar/standard mode: stable progress and balanced potential.
- Experimental mode: higher originality and variance, weaker accessibility.
- Commercial mode: lower variance, stronger accessibility, lower extreme originality.
- Instrumental mode: lower lyric progress requirement emphasis in sessions, but conversion still requires safe completion values until the schema supports mode-specific targets.

## Final potential model

Potential is calculated and stored before final quality:

```json
{
  "craft": 612,
  "attributes": 168,
  "genre": 103,
  "project_choices": 74,
  "collaboration": 58,
  "variance": 0.021,
  "raw_score": 1015,
  "potential": 842,
  "balance_version": "songwriting_progression_v2"
}
```

Approximate contribution targets:

- Craft/skills: 40-55%
- Attributes: 15-25%
- Genre knowledge: 10-15%
- Project choices: 5-15%
- Collaboration: 5-15%
- Controlled variance: normally ±3-5%, wider for experimental mode

## Final quality formula

`Final quality = potential × completion factor × polish factor × consistency factor`

Completion factor prevents half-written concepts from receiving full quality. Polish and consistency are capped so extra sessions cannot inflate songs indefinitely.

## Diminishing returns

Pre-completion sessions grant full progress. Once music and lyrics are complete, sessions shift toward capped polish and small arrangement/consistency gains. Repeated sessions reduce progress with a floor.

## Stored breakdown

Projects and songs store:

- `calculation_version`
- `songwriting_breakdown`
- `songwriting_input_snapshot`
- `random_seed`
- `variance_applied`
- `completed_at`

The breakdown supports player explanations, admin diagnostics, telemetry and future balance migrations without exposing hidden content.

## Follow-up recording and performance integrations

Recording quality and live gig performance should consume `song_rating` and selected breakdown fields later. They are intentionally out of scope for this PR.
