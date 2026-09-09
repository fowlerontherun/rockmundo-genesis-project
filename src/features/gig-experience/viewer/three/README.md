# Shared 3D gig viewer

`GigCanvas` now lazy-loads `GigStage3D` for live gigs, completed replays, the player
surface and the admin replay inspector. The historical `TopDownGigViewer` and
`RealtimeGigViewer` exports are compatibility wrappers for the shared player.
Gig history offers one 3D stage view alongside the authoritative report.

The approved admin demo's `ConcertScene` remains the renderer. A standalone demo
still runs its fictional band on its own clock. Production supplies the actual
lineup, venue and a `ConcertFrame` reconstructed from `DerivedPlaybackState`.
The replay timestamp is the only production animation clock: pause, seek,
backwards navigation and playback speed affect band motion, lights and audience
consistently. Camera and quality preferences update the existing context.

The scene retains local PBR venue textures, ACES tone mapping, environment light,
shadows, haze and bloom. Pub/club/theatre, arena/stadium and outdoor festival/beach
architecture derive from the existing venue classification. Views include a wide
stage, performer, drummer, director cuts and a camera looking out from the stage.
The actual lineup supports vocals, guitars, bass, drums, keyboard/piano, DJ,
strings, brass and percussion; unknown roles stay unarmed performers rather than
being invented guitarists. Some related instruments share a visual family.

Entrance and exit paths use the existing performer lifecycle model; fixed
instruments stay at their stage slots during performances. Selected performance
items drive gestures, dancing, stage dives, crowd surfing, phone lights, crowd
reactions and confetti/light accents. Audience numbers are representative and
bounded to 160 instances; an authoritative attendance of zero remains empty.
The surface retains the existing audio, results and replay permissions. A
collapsible, accessible commentary/timeline is available in player mode too.

Low quality caps rendering to 30 fps and DPR 0.9, disables shadows/bloom/haze;
standard/high retain the demo lighting with DPR caps of 1.15/1.75. Reduced motion
holds performance poses and removes decorative movement. Asset or WebGL errors
have a retry action while playback and the text timeline remain available.

## Verification

- `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p tsconfig.stage-models.json`
- `./node_modules/.bin/vitest run --config vitest.stage-models.config.ts --maxWorkers=1`
- `npm run build`
- Database gate documented in `src/features/player-model/README.md`.

The dedicated test configuration mocks the database client and disables network
requests. The component release gate uses a mocked WebGL backend; it is not a browser GPU
performance certification. Real rig geometry was inspected separately. The
approved demo was reviewed by the user; this integrated release still needs a
visual pass on the deployed desktop and mobile clients before merging/release.
