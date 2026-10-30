# Admin 3D concert demo

An isolated, local performance fixture at `/admin/gig-viewer-demo?view=3d`.
The existing AdminRoute protects access. This demo does not load or mutate live
gigs, setlists, finances, rewards or player avatars. Runtime assets are served
locally from `public/gig-demo-3d`; their sources and licences are recorded there.

The demo uses Three.js already installed by RockMundo. Scene updates run outside
React. Camera, lighting and crowd controls do not recreate the WebGL context.
Reduced motion, page visibility, resource disposal and model-load failures are
handled by the scene lifecycle.

## Open the demo

Sign in as an administrator. Open **Admin → Bands & Performance → 3D Concert
Demo**, or use **Open 3D Concert Demo** in the existing Gig Viewer Demo. The
query-free route continues to open the existing fixture/replay inspector.

## Visual direction

- An intimate club with a timber stage, brick walls, folded velvet backdrop,
  trusses, amp stacks, monitors, cables, wall lights and a detailed drum kit.
- Locally hosted 1K Poly Haven wood and brick materials with colour, OpenGL
  normal, roughness and ambient-occlusion maps. Reflections use a prefiltered
  environment; lighting uses soft shadows, gentle bloom and optional haze.
- Four stylised, rigged human performers. Procedural two-bone IK places hands
  on the guitar/bass and microphone; the drummer has seated legs and moving
  sticks. This is authored skeletal motion, not captured performance footage.
- Sixteen human crowd variants, baked into GPU instances with seeded spacing,
  height/clothing variation, raised arms and independent movement phases.
- Singers blend gestures and use stylised mouth articulation with breath breaks;
  the microphone follows the face. This is procedural performance, not audio lip sync.
  Guitarists hold chord positions and slide between them, drummers alternate
  strokes and fills, and keyboard players depress keys under their hands.
- Energetic crowds can open a local circle pit or carry an audience member above
  nearby raised hands. Attendance is preserved. Quiet/sparse crowds, cramped
  floors, runways, television studios and reduced motion suppress these events.
  The crowd-reaction selector includes dedicated circle-pit and surfing previews.
- Twelve views, including a deterministic camera sequence, singer and bassist close-ups, low pit, stage-wing, reverse backline-to-crowd, and crane shots, plus three lighting palettes. Large-venue Director coverage returns regularly to a close performer lens.
  Play/pause, restart, fullscreen, performance intensity, crowd density, haze,
  quality and reduced motion are available without rebuilding the renderer.

The preview is **silent**, with a 96-second presentation loop. It does not
represent a real gig, play a user's songs, or reuse the live replay timeline.
It has one art-directed room and fixed fictional performers. The characters
have a deliberately stylised shape; this is not a photorealistic avatar system.

## Runtime boundaries

- No new dependencies, database reads/writes or avatar-service requests in the
  demo module. Normal application shell/authentication still applies.
- Lazy loading keeps the 3D renderer off the default replay-inspector path.
- Static equipment shares draws by material. The audience uses sixteen instance
  batches, up to 160 people. Only two spotlights render 1024px shadow maps.
- Pixel ratio is capped at 1.15 in Balanced mode and 1.75 in High detail.
- Hidden tabs stop the frame loop. Leaving/retrying disposes the renderer,
  textures, geometries, skeleton textures, shadow maps and postprocessing.
- Missing assets or a lost graphics context produce a retry control. Reduced
  motion fixes the pose, particles and automatic camera movement; manually
  choosing a camera still works.

## Verification

```sh
./node_modules/.bin/vitest run --config vitest.stage-models.config.ts --maxWorkers=1
./node_modules/.bin/tsc --noEmit -p tsconfig.stage-models.json
npx eslint src/features/gig-demo-3d
npm run build
```

The tests parse the actual shipped GLBs and check finite articulated poses,
instrument contact, independent skeleton clones, reduced motion and crowd
density. Component tests cover controls, retry, unsupported WebGL and disposal
on unmount (with the renderer mocked).

Crowd choreography is reconstructed from replay time and, for explicit mosh/surf
performance items, the item's progress. Tests also cover a clear pit center,
runner spacing, exact attendance while surfing, backwards seeks, singer gesture
continuity, mouth/microphone alignment and reduced-motion suppression.

Browser visual/performance QA was unavailable in the implementation environment
because its browser URL policy blocked the app preview. These tests and the
production build do **not** verify lighting appearance, camera framing, GPU
frame rate or real WebGL context recovery. Review those in the admin demo on a
hardware-accelerated desktop browser before approving the visual direction.

The repository-wide typecheck exhausted the default Node heap; the isolated
strict config above covers every demo source and test file.


## Venue expansion

The admin preview now has a Venue setting selector covering the game's 21 canonical
venue types, plus the original approved club. Capacity can be changed independently
without touching game records. Production reads the real venue type, ID and capacity
from the existing gig DTO; no new queries or database changes are required.

Exact types override venue names. The five legacy labels (`arena`, `club`, `theater`,
`amphitheater`, `large_venue`) map to the appropriate canonical or capacity-based
setting. The catalogue was checked against all 26 distinct labels in `public.venues`.

| Venue settings | Visible architecture |
| --- | --- |
| Street corner / city square | Street edges, surrounding buildings, lamps; square monument |
| Café / jazz lounge / dive bar | Side tables, counter, bottles, practical lighting and appropriate decor |
| Rock club / live house / university union | Posters, bar, stage-side displays or union bunting |
| Warehouse / church hall | Industrial beams and containers, or pitched roof and tall windows |
| Concert hall / theatre | Acoustic wood panels or proscenium, balconies and seating |
| Indoor arena / ice arena / stadium | Tiered seating, touring screens, control booth; rink boards or stadium flags |
| Amphitheatre | Curved outdoor terraces and trees |
| Park bandstand | Pavilion roof, columns and park planting |
| Rooftop terrace | Parapets, planters and surrounding skyline |
| Festival tent | Peaked canvas roof and perimeter poles |
| Beach stage / festival stage | Covered stage, service tents, palms/water or open field |

Capacity bands (up to 100, 500, 3,000, 15,000 and above) drive deck width/depth,
floor height, room dimensions, rig, audience bounds and camera framing. Performer
and stationary-instrument positions use the same transform as replay movement.
Venue ID seeds stable decorative variation across gigs at the same venue.

Up to 160 detailed audience models are retained. Large/seated venues add at most
1,800 inexpensive distant instances (500 on low quality); actual occupancy and
arrival/exit progress control visibility. These represent audience scale, not a
one-to-one seating chart or an exact replica of real-world venues. The original
admin demo remains selectable with its original dimensions and camera behaviour.

Verification: offline stage suite, scoped TypeScript and production build. New
checks build every environment, check batching/finite geometry and empty initial
crowds, test all labels and capacity tiers, compare preview controls and verify
that fixed instruments match replay positions. Camera checks project the full
performance area into portrait and landscape viewports for every capacity tier. The browser GPU/visual pass is
still needed before release; mocked component tests do not certify appearance.


### Gig motion and crowd direction

Ordinary gigs use replay-derived presentation cues for these visual improvements:

- Crowd arm poses ease between reactions, with individual response delays and smooth changes in the automatic seven-second activity cycle. Transition state is packed into the existing instance attribute to stay within mobile GPU limits.
- Quiet fans retain restrained upper-body movement. Reduced motion freezes articulation and hides phone screens.
- Waves travel across fan positions. The distant instanced audience now has raised-arm and clap poses, travelling waves and a subset of hand-held phones, without adding audience draw calls or changing attendance.
- The sixteen detailed crowd identities sample the full starter wardrobe rather than the first six catalogue entries.
- Director cameras react to chorus entrances, breakdowns, solos and endings while retaining recurring close shots in large venues.
- Lighting opens up for choruses, narrows for verses/breakdowns, and aims the first two solo lights at the featured performer.
- Performer rigs and crowd claps share a presentation rhythm clock. Saved numeric `song_start.messageParams.bpm` values from 40–240 are accepted; legacy replays use 120 BPM. Existing replay generation normally has no BPM, so this fallback is visual timing, not audio beat detection.
- The post-song release window uses the full intro/performance/highlight span rather than the intro duration. It never inserts applause inside the saved song performance.

These cues do not change gameplay outcomes or require database migrations. TV camera choreography remains separate. Section cues may be inferred from the replay; they are not an analysis of the audio waveform.

Validation:

```sh
npx vitest run src/features/gig-demo-3d/showMotion.test.ts src/features/gig-demo-3d/crowdAnimation.test.ts src/features/gig-demo-3d/venueAudience.test.ts src/features/gig-demo-3d/gigCameraSequence.test.ts src/features/gig-demo-3d/venueLightShow.test.ts src/features/gig-experience/viewer/three/presentation.test.ts src/features/gig-experience/viewer/three/crowdPresentation.test.ts src/features/gig-experience/viewer/three/GigStage3D.test.tsx --maxWorkers=1
npx playwright install chromium
npm run test:gig-motion:webgl
```

The WebGL smoke test starts a local Vite fixture, loads the production scene, renders on demand with software WebGL, checks shader errors, and verifies crowd/camera reconstruction after seeks and crowd freezing under reduced motion. It needs no account or live database. It is a correctness smoke test, not a hardware FPS benchmark.


### Ordinary gig camera clearance

Ordinary venue cameras now resolve their final pose against a cached spatial tree of opaque scenery triangles. Wall, roof, stage and prop geometry can shorten or redirect a shot; doorways and proscenium openings remain open. Nine parallel rays protect the central sightline and a near-plane footprint sized for the camera aspect ratio and maximum corrected field of view. Transparent haze, sky domes, instanced audiences and animated fixtures are excluded from the static tree.

Room/deck limits and nearby performer/front-row safety bubbles apply after shot composition. The pit lens has a minimum height above front-row heads. When a wall forces a closer lens, the field of view widens (up to 100 degrees) to retain more of the subject on narrow screens. Corrected poses and manual shot changes use direct positioning rather than interpolating through intervening scenery. The correction has no last-good-pose state, preserving replay seeking; TV broadcast camera paths remain separate.

The static tree is built once per scene and freed on disposal. A bounded query cache avoids repeated ray tests for stationary framing. Foreground crowd clearance uses the existing detailed fan instances, never all stadium spectators.

Checks: `npx vitest run src/features/gig-demo-3d/cameraCollision.test.ts src/features/gig-demo-3d/cameraCollision.venues.test.ts src/features/gig-demo-3d/venueCamera.test.ts src/features/gig-demo-3d/venueCameraAngles.test.ts --maxWorkers=1`.

`npm run test:gig-motion:webgl` additionally renders manual camera angles in a club and a portrait café and checks their scenery sightlines. The geometry suite covers 11 shots on portrait/landscape/ultrawide displays across cafés, bars, theatres, arenas, festival tents and stadiums. These tests verify collision correctness, not an FPS guarantee or visibility of every performer in every composition.


When every local camera correction is obstructed or closer than 1.6 metres to the subject, the resolver searches a bounded set of alternative angles around that subject. Clearance outranks preserving the original angle, and the search order is fixed for replay consistency. The static index includes opaque back-face walls, excludes background sky spheres, and honours each geometry's rendered draw range so hidden triangles do not create phantom obstacles.


Lens clearance checks now include edge midpoints as well as the centre/corners, preventing thin scenery posts from slipping between those samples. Clearance grows with the near plane, screen aspect ratio and maximum corrected FOV; the same footprint governs scenery queries, body separation and room margins. The bounded collision-query cache includes footprint dimensions, so resizing cannot reuse a result from a narrower lens. Browser smoke coverage includes a 2400×600 ultrawide viewport.
