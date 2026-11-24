# RockMundo AI music videos: Basic / Advanced direction and validation

## Scope

This is the VIP **AI clip generator** in `VipVideoCreationDialog`, not the separate
music-video release planning/configuration system. It retains the existing
VIP requirement, $75,000 in-game charge, character/song ownership checks,
idempotent reservation, Replicate webhook verification, and refund handling.

## What the current provider really accepts

RockMundo currently calls `minimax/video-01-live` on Replicate, after creating
one starting image via Lovable's Gemini image gateway. Replicate's published
input schema for this model exposes only:

| Input | Used by RockMundo | Meaning |
| --- | --- | --- |
| `prompt` | Yes | Natural-language visual direction for one short clip |
| `first_frame_image` | Yes | Image generated from the same creative brief |
| `prompt_optimizer` | No explicit value; provider default | May rewrite/expand the prompt |

Source: https://replicate.com/minimax/video-01-live/api/schema

The model does **not** expose a full-song timeline, soundtrack/audio sync,
multi-shot editing, independent camera-setting parameters, duration or
resolution controls. Replicate describes Video 01 Live as a 5-second, 720p
model in its model comparison, and its schema currently lists $0.50 per
generated clip. Source: https://replicate.com/blog/compare-ai-video-models

The app must therefore call this a short AI visual clip rather than a
complete, audio-synced music video. Camera, movement, lighting, and colour
choices are natural-language directions, **not hard guarantees**.

## Player experience

- **Basic Video (default):** pick an owned recorded song, name the video, and
  choose one visual theme. The system supplies a scene concept and defaults.
- **Advanced Video:** additionally choose art style, mood, a single main
  shot/action (optional), camera movement, lighting, colour palette, and
  subject motion. All advanced choices are optional; `AI decides` is provided
  where a neutral default is appropriate.
- Both modes display the same in-game cost and the short-clip/audio limitation.
- Switching back to Basic ignores hidden advanced values for the generated
  brief. Starting a new video resets to Basic.

The paid reservation stores normalized creative direction in the existing
`music_videos.description` JSON text field; no schema change is needed.
The Edge Function retrieves the saved direction and the song's database title
and genre, builds both the first-frame and video-motion prompts, and sends
only supported provider inputs. Historical reserved jobs containing
`scene_descriptions` retain their first non-empty scene as the shot concept.

## Automated validation

Run:

```bash
npx vitest run \
  src/components/music-video/VipVideoCreationDialog.test.tsx \
  src/lib/api/__tests__/musicVideoPrompt.test.ts \
  src/lib/api/__tests__/musicVideoWebhookAuthority.contract.test.ts
```

Assertions include basic defaults, opt-in advanced controls, each control's
presence in the appropriate generated prompt, bounded free-text inputs,
fallback of invalid enumerated choices, backward compatibility with old
reservations, and preserved atomic payment/webhook protections.

## Live output validation still required

The tests prove that the model receives meaningful text directions; they
**do not prove that every visual instruction appears in the generated clip**.
An authorized paid test should compare short clips using the same song/title
and theme, changing only one element per pair:

| Pair | Control varied | What to review |
| --- | --- | --- |
| A | Fixed camera vs orbit | Is the camera motion visibly different? |
| B | Warm vs cool palette | Does dominant colour change in both frame and clip? |
| C | Subtle vs intense motion | Does performer movement meaningfully differ? |

Check provider success, playback, duration, first-frame consistency, and
saved video metadata. A minimum six clips would cost about **$3 in Replicate
video output fees**, *plus* any first-frame image-generation charges; verify
current pricing and ask for a specific budget before creating paid outputs.
Do not auto-retry test runs or deduct players' in-game cash for quality testing.

## Future work, intentionally not implied by these controls

- Build true song-length video via multiple generated clips, continuity
  controls, editing and an audio muxing pipeline.
- Validate aspect ratio, audio, captions and playback on the assembled output.
- Evaluate newer image-to-video models separately against quality, licensing,
  latency, price and supported inputs before switching production model.
