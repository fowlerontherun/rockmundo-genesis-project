

## Fix: Tutorial World Map Link Goes to 404

### Problem
The tutorial step `visit_world_map` directs players to `/world-map`, but that route is commented out in `App.tsx` (line 532), causing a 404.

### Solution
Uncomment the `/world-map` route in `App.tsx` to re-enable the WorldMap page. The component (`WorldMap.tsx`) and its lazy import already exist and are functional.

### Files to modify
- **`src/App.tsx`** — Uncomment line 532: `<Route path="world-map" element={<WorldMap />} />`
- **`src/components/VersionHeader.tsx`** — Bump to v1.0.890
- **`src/pages/VersionHistory.tsx`** — Add changelog entry

