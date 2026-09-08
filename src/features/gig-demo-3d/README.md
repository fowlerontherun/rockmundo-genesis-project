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
npx vitest run src/features/gig-demo-3d
npx tsc --noEmit -p tsconfig.gig-demo-3d.json
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
