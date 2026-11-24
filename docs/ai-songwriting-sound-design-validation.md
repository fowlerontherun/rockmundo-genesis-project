# RockMundo Basic / Advanced Songwriting — AI sound validation

## Delivered behaviour

- **Basic Songwriting** is the first, lowest-friction option: title, allowed genre and optional mood. It creates an ordinary solo songwriting project with the existing scheduling, progression, skill and completion rules. Other sound settings remain automatic.
- **Advanced Songwriting** retains the full writing workflow and offers optional BPM, key, energy, vocals, guitar tone, production and arrangement choices in the existing creative brief. Featured instruments remain a separate existing selector.
- Both modes store sound decisions in the existing `songwriting_projects.creative_brief` JSONB. No new unguarded client-authoritative score or database column is introduced.
- On recording/audio generation, **both player and admin generators** use `buildSongStylePrompt` to translate the saved brief, selected instruments, the band's sound, theme, chord progression and quality into a provider-specific style prompt.
- Music 1.5 receives a bounded 300-character style prompt and a compact 600-character lyric edit. Music 2.6 permits up to 2,000 style characters and 3,500 lyrics, preserving expanded section markers (including an optional `[Solo]` from the player's arrangement selection).
- The existing durable provider queue, weekly limits, VIP checks, recording workflow, ≥60-second audio validation, manual-regeneration confirmation and no-automatic-paid-retry rules are unchanged.

## Supported by provider input schemas (not yet sonic listening verification)

| Player input | Music 1.5 | Music 2.6 | Mechanism |
|---|---|---|---|
| Genre, mood, instrumentation, vocal delivery, production | Prompt text, best effort | Prompt text, best effort | Structured attributes translated into musical language |
| BPM and musical key | Prompt guidance, best effort | Improved prompt control | Numeric/key terms in style prompt |
| Standard verse/chorus/bridge/outro | Basic section tags | Section tags | Lyrics structure |
| Advanced build-up and solo | Prompt guidance, limited structural control | `[Build Up]`, `[Solo]` etc. | Expanded lyrics tags |
| Instrumental-only songs | Not exposed | Model supports `is_instrumental` | **Deferred**: queue payload and eligibility policy need separate implementation; no misleading toggle in UI |

Replicate schemas: [Music 1.5](https://replicate.com/minimax/music-1.5/api/schema) and [Music 2.6](https://replicate.com/minimax/music-2.6/api/schema).

## Non-paid verification

Run:

```bash
npx vitest run src/hooks/__tests__/songSoundPrompt.test.ts src/hooks/__tests__/shortSongLyrics.test.ts src/hooks/__tests__/aiSongQueue.contract.test.ts src/components/songwriting/SongSoundDesignFields.test.tsx
```

Tests verify Basic defaults, optional controls, existing instrument/mood propagation, explicit overrides, prompt character limits, preservation of longer Music 2.6 lyrics, acoustic separation, and intact queue calls.

## Paid sonic acceptance gate — explicit approval required

Do not call Replicate to test paid generation until a spending cap is approved.

1. Generate a Basic rock track with unchanged lyrics and band setup; confirm the existing ≥60-second validator and end-to-end queue behaviour.
2. Change **only** featured instruments; listen and record whether the requested instrumentation is recognisable.
3. Change **only** mood/energy; listen for a meaningful arrangement and dynamics difference.
4. Change **only** vocal delivery; note whether the performance changes appropriately.
5. For Music 2.6, request BPM/key and a solo, then assess actual tempo/key and section structure.
6. Log the selected profile, final provider prompt, model, audio duration, cost, listener score and any non-adherence. Keep earlier successful audio until a paid replacement is fully validated.

The provider is generative and non-deterministic: valid prompt fields establish compatibility, not guaranteed audible adherence. Keep low-adherence features out of the UI or label them as approximate until these listening checks pass.
