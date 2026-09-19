# Top of the Pops deterministic render worker

Phase 2 is implemented as a privileged external worker. The browser remains the
game/control surface; the finished programme is produced offline from the frozen
episode manifest and immutable replay snapshots.

## Security model

The worker does **not** receive a Supabase service-role key. GitHub Actions asks
GitHub for a short-lived OIDC token with audience `rockmundo-totp-render`.
The deployed `totp-render-worker-gateway` Edge Function verifies:

- issuer: GitHub Actions OIDC;
- repository: `fowlerontherun/rockmundo-genesis-project`;
- ref: `refs/heads/main`;
- workflow: `.github/workflows/totp-render-worker.yml`;
- event: scheduled or manually dispatched;
- signature, expiry and audience.

Only after those checks can the gateway claim/heartbeat/fail/complete a render
job or mint a one-use signed Storage upload token. The Supabase service key
never leaves Supabase.

## Queue and lease lifecycle

1. Admin queues a render from the TOTP control room.
2. The GitHub worker runs every ten minutes and calls
   `totp_claim_render_job_v2`.
3. The job is leased to the GitHub run, with progress and heartbeats.
4. A crashed worker can be reclaimed after 15 minutes, up to three attempts.
5. A successful QC result promotes the matching frozen manifest to
   `rendered_master`.
6. Artifacts are immutable/content-addressed under:
   `episode_id/manifest_checksum/sha256/filename`.

Large master uploads use Supabase Storage's TUS resumable endpoint in mandatory
6 MB chunks. The bucket `totp-broadcast-masters` is private; admins receive
short-lived signed download URLs from the control room.

## Deterministic picture

The worker builds the exact commit in the GitHub run and starts a local Vite
preview. It injects the manifest, render plan and immutable replay snapshots into
`/internal/totp-render`, which performs no database lookup.

Every output frame is selected from the authoritative timeline:

- 1920×1080;
- 30 fps;
- exact expected frame count;
- browser wall-clock does not advance programme position;
- CSS animations are paused and explicitly seeked to the programme time;
- camera and performer state comes from the frozen replay and requested
  programme millisecond.

Frames are piped directly into FFmpeg rather than written as thousands of
temporary images.

## Deterministic audio

The worker separately assembles 48 kHz stereo PCM on the same timeline:

- song recording for performances;
- versioned recorded presenter audio for presenter links;
- studio ambience under speech/music;
- applause/crowd source where available;
- deterministic low-level generated room tone only as a fallback.

The complete mix is two-pass loudness normalised before AAC delivery. The
delivery target is -14 LUFS, with extra headroom so final true peak remains at
or below -1 dBTP.

## Outputs

Each successful render stores:

- H.264/AAC 1080p master MP4;
- H.264/AAC 720p proxy MP4;
- poster JPEG;
- up to four thumbnail candidates;
- WebVTT subtitle file;
- YouTube-style chapter text.

The render job stores SHA-256 values for the master, timeline and complete input
fingerprint, plus per-artifact hashes.

## Automated QC gate

The master is rejected unless all checks pass:

- duration within two seconds of plan;
- 1920×1080, 30 fps H.264;
- AAC stereo at 48 kHz;
- exact expected video frame count;
- A/V end drift below one frame;
- programme loudness within ±1 LU of -14 LUFS;
- true peak no higher than -1 dBTP;
- expected chapter count;
- no sustained black frame;
- no sustained frozen frame;
- no silence gap longer than 2.5 seconds;
- no generated caption readability/overflow issue.

FFprobe, loudnorm, blackdetect, freezedetect and silencedetect measurements are
stored with the render job so the control room can audit the master later.

## Local/manual use

The privileged claim/complete flow intentionally only accepts the approved
GitHub Actions identity. For normal operation, use **Actions → TOTP
deterministic render worker → Run workflow**, or allow the ten-minute schedule
to claim queued work.

Unit checks:

```bash
npm run test:totp
npm run test:totp:worker
npm run verify:migration-timestamps
```

Database gate against a safe test database:

```bash
npm run test:totp:db
```
