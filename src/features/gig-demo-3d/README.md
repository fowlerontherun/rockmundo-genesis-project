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
- Three human crowd variants, baked into GPU instances with seeded spacing,
  height/clothing variation, raised arms and independent movement phases.
- Five views, including a camera sequence, plus three lighting palettes.
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
- Static equipment shares draws by material. The audience uses three instance
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
