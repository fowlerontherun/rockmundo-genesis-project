# Top of the Pops render worker contract

Phase 2 of the broadcast roadmap. The game database owns the queue; an external
worker (a machine with a headless browser and ffmpeg) does the rendering. The
worker uses the Supabase **service role** key.

## Loop

1. `select * from totp_claim_render_job()` — returns at most one job, marks it
   `rendering` and increments `attempts`. An empty result means nothing to do.
2. Read `job.plan` (built by `buildTotpRenderPlan` in
   `src/features/top-of-the-pops/renderSpec.ts`). It is the complete shot list:
   ordered items with `start_ms`/`duration_ms`, chapters, poster and thumbnail
   marks, delivery filenames and the programme spec.
3. Render deterministically:
   - Open the archive viewer route in headless Chromium at 1920x1080, seek to
     each item's `start_ms`, capture frames at 30fps.
   - Mix audio using the same balance table (`broadcastAudioMix.ts`): song bed
     ducked under presenter links, audience layer behind the music.
   - Encode H.264 / AAC stereo, normalise to -14 LUFS with a -1 dBTP ceiling.
   - Write `master.mp4`, `proxy.mp4`, `poster.jpg`, `.vtt` captions (from
     `toTotpWebVtt`) and the `-chapters.txt` file (`toTotpChapterFile`).
4. Probe the master with ffprobe/loudnorm and build a `TotpRenderProbe`, then run
   `evaluateTotpRenderQc(plan, probe)`.
5. `select * from totp_complete_render_job(job_id, artifacts, qc)` where
   `artifacts` is an array of `{kind, filename, url, bytes, sha256}` and `qc` is
   the result of the checks. A `qc.passed = false` result marks the job failed;
   a pass also promotes the episode running sheet to `rendered_master`.
6. On a crash, call `totp_fail_render_job(job_id, error)` so admins see why.

## Rules

- Never render a job whose `manifest_checksum` no longer matches the stored
  running sheet — re-queue instead. The enqueue RPC already enforces this.
- Renders must be reproducible: the same plan must produce the same duration and
  chapter layout every time.
- Only one active job per episode; the database enforces this with a partial
  unique index.
- Artefact hashes (`sha256`) are required for delivery audit and later YouTube
  upload verification.
