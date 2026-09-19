# Top of the Pops deterministic render worker

Phase 2 uses a frozen episode manifest and a server-authoritative render plan to create the canonical programme master. Browser playback and the manual MediaRecorder export are previews/backups only; they are never accepted as the broadcast master.

## Hosting

The worker is hosted by GitHub Actions in `.github/workflows/totp-render-worker.yml`.

- It runs every 15 minutes and can also be dispatched manually.
- The workflow has `id-token: write` and authenticates to the Supabase render broker with a short-lived GitHub OIDC token.
- No Supabase service-role key is stored in GitHub.
- `supabase/functions/totp-render-broker` verifies the GitHub token, repository, workflow and `main` ref before using its server-side service role.
- One workflow claims one job. Database leases, heartbeats and stale-job recovery allow up to three attempts without two workers rendering the same job.

## Render clock

The worker builds the application and serves the dedicated `totp-render.html` page locally. That page has no database credentials and accepts only the already-frozen render payload injected by Playwright.

For every output frame:

1. Calculate absolute programme time as `frame_index / 30fps`.
2. Map that time to one render-plan item and an exact local offset.
3. Drive the existing TOTP 3D replay scene with `externalClock: true`.
4. Wait for the scene to render that explicit position.
5. Capture the full 1920×1080 programme frame.

The Three.js scene never advances from browser wall-clock time in this mode. Camera moves, performer animation, crowd state and lighting therefore derive from the same frozen replay position on every run.

## Audio master

FFmpeg owns the audio clock.

- Performance recordings start at their render-plan timecodes.
- Presenter links must use the recorded `presenter_audio` asset frozen into the manifest. Device speech synthesis is rejected.
- Approved studio ambience/applause clips are selected deterministically from the crowd-sound library.
- The final mix is 48 kHz stereo.
- A two-pass EBU-style loudness pass targets -14 LUFS and a -1 dBTP true-peak ceiling.

The final master is H.264/AAC, 1920×1080, 30 fps. A 720p proxy is produced separately.

## Outputs

Every successful job writes immutable objects below:

`totp-broadcast-masters/<episode>/<manifest checksum>/<render job>/`

Artifacts are:

- master MP4
- proxy MP4
- poster JPEG
- up to three thumbnail JPEGs
- WebVTT captions
- chapter text file

The bucket is private. Admin download links are one-hour signed URLs generated when the control room loads a completed render.

Large objects use Supabase Storage's TUS resumable upload endpoint in 6 MB chunks with short-lived signed upload tokens issued by the broker.

## QC

After encoding, the worker uses ffprobe/FFmpeg to check:

- exact programme duration
- expected frame count
- 1920×1080 resolution and 30 fps cadence
- H.264 video and AAC stereo audio
- 48 kHz sample rate
- end-of-programme A/V drift no greater than one frame
- -14 LUFS ±1 LU and true peak at or below -1 dBTP
- black-frame duration
- frozen-frame duration
- unexpected silence
- caption safe-layout limits

QC failures are stored on the render job and the job is not promoted to an approved master.

## Integrity

Each completed job stores SHA-256 fingerprints for:

- the authoritative timeline/render plan
- the frozen input package
- the master MP4
- every individual artifact

A successful completion promotes the stored episode state to `rendered_master` only when the job still refers to the same manifest checksum.

## Failure recovery

The worker sends heartbeats and progress throughout frame capture, encoding and upload. If a process disappears, a lease becomes stale after 15 minutes. The next worker run may reclaim it until the third attempt; after that the database marks it failed for operator review.

Cancellation remains an admin action in the control room. A worker whose lease has been cancelled cannot heartbeat, upload completion metadata or promote the master.
