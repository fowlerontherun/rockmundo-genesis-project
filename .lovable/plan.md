# Blind box: drop songs as "finished written", not pre-recorded

## What's happening today

`supabase/functions/open-blind-box/index.ts` (lines ~273-296) inserts the dropped song into `public.songs` with:

```ts
status: "recorded",
catalog_status: "private",
ownership_type: "personal",
music_progress: 1000,
lyrics_progress: 1000,
completed_at: new Date().toISOString(),
```

That permanently marks the song as already recorded, so it skips the player's recording workflow and is mis-classified next to gigged/released tracks.

## What you want

Blind-box drops should appear as **finished written songs** — fully written, with all quality stats and lyrics filled in, but not yet recorded — so the player can either:
- record them in the studio (normal flow), **or**
- list them for sale / trade on the existing marketplace, the same way a song written through the songwriting screen can be sold.

The marketplace and trade flows already accept any owned song regardless of `status`, so this is purely an insert-payload change.

## Change

Single edit in `supabase/functions/open-blind-box/index.ts`, in the `songs` insert block:

| Field | Before | After |
| --- | --- | --- |
| `status` | `"recorded"` | omitted (defaults to `'draft'`) |
| `music_progress` | `1000` | `2000` (matches DB default — fully written) |
| `lyrics_progress` | `1000` | `2000` |
| `completed_at` | `new Date().toISOString()` | `null` |
| `ownership_type` | `"personal"` | unchanged |
| `catalog_status` | `"private"` | unchanged |
| `original_writer_id` | not set | set to `profile.id` so it lines up with songwriting-flow songs and the marketplace attribution |

All quality fields (`quality_score`, `song_rating`, `melody_strength`, `lyrics_strength`, `rhythm_strength`, `arrangement_strength`, `production_potential`) stay as they are — the song is fully written, just not recorded.

Duplicate-handling, gear minting, pity, XP/AP and the response payload are unaffected.

## Version + history

- Bump to `v1.1.316` in `src/components/VersionHeader.tsx`.
- Add a `fix` entry in `src/pages/VersionHistory.tsx` explaining that blind-box song drops are now finished written songs (not pre-recorded), so they can be recorded later, sold, or traded like any song from the songwriting flow.

## Out of scope

- No DB migration — the existing columns and defaults already support this state.
- No marketplace / trading code changes — listings already accept any owned song.
- No UI changes — `BlindBoxRevealDialog` / `BlindBoxInventory` keep showing the song; downstream pages will simply pick it up under "written songs" instead of "recorded songs".
