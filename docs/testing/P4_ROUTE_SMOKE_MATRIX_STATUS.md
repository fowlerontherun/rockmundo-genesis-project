# P4 route smoke matrix status

Implementation branch: `codex/p4-route-smoke-ui-state-matrix`

Implemented:

- dynamic smoke coverage across the live `App.tsx` route table;
- required unauthenticated, new-player, established desktop, established mobile, page-state, and browser-history scenarios;
- loading, empty, error, retry, back, forward, and replace coverage;
- compatibility redirect query preservation and replace semantics;
- executable manifest validation to stop coverage from silently disappearing.

No database change is required.
