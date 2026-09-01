# P4 acceptance mapping

- Route inventory matrix: dynamic route extraction from `src/App.tsx` plus canonical Festival route patterns.
- Auth/new/existing/mobile: required scenarios in `src/testing/route-smoke-matrix.json`, backed by existing critical-journey/mobile tests and the live route inventory tests.
- Loading/empty/error: `page-state.routeSmoke.test.tsx` covers the shared production states and retry behaviour.
- Crash/404 regression: every declared route is server-rendered through the real App provider and route tree; route ownership audit rejects unowned/duplicate/ambiguous authenticated routes.
- Back/forward: `navigationHistory.routeSmoke.test.tsx` covers push/back/forward and replace semantics.

No database changes.
