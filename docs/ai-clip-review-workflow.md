# AI Clip Review & Reinforcement Workflow

This workflow explains how AI-generated performance clips are evaluated, scored, and recycled back into future prompt heuristics inside the Media Studio experience.

## 1. Generation & intake
- Clip prompts originate from the campaign scheduler or the Clip Virality Lab and include explicit metadata (tempo, mood, instrumentation, palette, intended length).
- Each render carries auto-analysis (loudness, crest factor, recommended use case, highlights) that is surfaced in the **AI clip review board** on `src/pages/media/studio.tsx`.

## 2. Qualitative review
- Reviewers capture two qualitative ratings – **Mix polish** and **Hook strength** – via the sliders. These map to qualitative statements ("Needs heavy edits", "Signature moment", etc.).
- Notes and an Accept/Pending/Reject decision are required per clip so editorial, sync, or marketing teams know what to fix before publishing.
- Saving a review timestamps the submission so leads can audit when a clip was approved.

## 3. Analytics feedback
- Logged reviews feed the in-page analytics tables and charts. Tempo cohorts, mood profiles, and instrument combinations are aggregated so strategists can see which prompt features trend toward higher reviewer scores or acceptance rates.
- The **Prompt pairings** table highlights full prompt bundles (tempo + mood) with the associated decision so writers can recycle best-performing settings.

## 4. Reinforcement & fine-tuning hooks
- Any clip marked Accepted with an average score ≥ 4.0 becomes eligible for reinforcement.
- The **Reinforcement & fine-tuning hooks** card lists emerging heuristics harvested from those high-scoring clips.
- The "Update prompt heuristics" action simulates feeding those learnings back into generation weighting, while "Queue fine-tune dataset" marks clips for dataset export.

## 5. How creators influence future AI output
1. Generate prompts → AI renders clip with metadata.
2. Reviewer assigns qualitative ratings + notes → saved to local review state (and ready for persistence).
3. Ratings update analytics → prompt authors inspect correlations before writing the next batch.
4. Accepted, high-scoring clips → sent to heuristics and queued for fine-tuning datasets.
5. Subsequent prompt presets inherit those heuristics, so creators immediately feel the impact of their session-level scoring.

Keep this doc handy when onboarding reviewers or explaining to artists why deliberate scoring materially shapes upcoming AI generations.
