# P4 — Route smoke and UI state matrix

Status: COMPLETE on branch `codex/p4-route-smoke-ui-state-matrix` pending normal CI/merge.

## Purpose

P4 closes the consolidated backlog requirement for a route inventory smoke matrix covering authentication context, player maturity, mobile routing, loading/empty/error states, and browser history behaviour without creating a second routing authority.

## Implementation

- `src/__tests__/App.routeRender.test.tsx` now discovers literal routes directly from `src/App.tsx`, materialises dynamic parameters, includes canonical Festival route patterns, and server-renders every discovered route through the real App provider/route tree. The test also guards against accidentally shrinking back to a small hand-maintained shortlist.
- `src/testing/route-smoke-matrix.json` is the P4 coverage manifest. It records unauthenticated, new-player, established desktop, established mobile, shared page-state, and browser-history scenarios together with the executable tests that own each scenario.
- `src/testing/routeSmokeMatrix.test.ts` validates that every required P4 context/state remains represented and that all referenced test files still exist.
- `src/components/ui/page-state.routeSmoke.test.tsx` verifies accessible loading, explicit empty, actionable error, and retry behaviour using the shared page-state components.
- `src/config/__tests__/navigationHistory.routeSmoke.test.tsx` verifies forward/back navigation and replacement semantics, and checks that compatibility redirects preserve query strings while using React Router `replace` navigation.
- Existing P2 `routeOwnershipAudit.test.ts` remains the authority for route ownership, duplicates, ambiguity, admin boundaries, and compatibility redirect declarations.
- Existing P3 critical-journey tests remain the authority for actual auth/session recovery, new-character creation/onboarding, established gameplay journeys, and mobile quick-action behaviour.

## Matrix

| Context | Route/state coverage |
| --- | --- |
| Unauthenticated | Auth/session recovery plus real App route-tree construction |
| New player | Character-slot creation, onboarding/Getting Started, loading/empty/error contract |
| Existing player desktop | Dynamic live App route inventory, module ownership, admin boundary |
| Existing player mobile | Mobile route registry, navigation audit and daily-loop behaviour |
| UI states | Loading, empty, error, retry |
| Navigation history | Forward, Back, Forward, replace/query-preserving compatibility redirects |

## Acceptance criteria mapping

- **Build route inventory test matrix:** live routes are discovered from `App.tsx`; the P4 manifest ties contexts/states to executable tests.
- **Verify auth, new-player, existing-player and mobile behaviour:** each has a required manifest scenario backed by existing or new tests.
- **Verify loading/empty/error states:** shared production page-state components have direct regression coverage including retry.
- **Detect crash/hang/404 regressions:** every declared route is constructed/server-rendered through the real App tree, while P2 continues to reject unowned/duplicate/ambiguous authenticated routes.
- **Add browser back/forward navigation coverage:** MemoryRouter history tests cover push, back, forward and replace semantics; legacy Social/Media redirects remain query-preserving and replace-based.

## Database

No database schema, RLS, RPC, Edge Function, data repair, or live Supabase change is required. P4 is an application test/release-quality item only.
