# TV-studio performance polish

## What changes
- Expand television performance coverage with instrument-side angles, band two-shots, orbiting views and pull-backs alongside existing close-ups, tracking and crane cameras.
- Make each shot move like a planned TV camera move while following the actual performer and active studio stage.
- Add restrained rhythmic stage movement for mobile performers; keep drums, keyboards and stand microphones anchored.
- Preserve presenter segments, archived shot cues, gameplay outcomes and reduced-motion behavior.

## Technical approach
- Add pure replay-time camera and performer-motion helpers to the shared concert renderer, bounded by the authoritative studio geometry.
- Preserve all existing broadcast camera identifiers and replay data; extend the presentation mapping only.
- Test shot variety, seek determinism, reduced motion, all four stage footprints and stationary equipment; visually inspect desktop and narrow-screen renders.
- Update the banner version, version history and project rules.