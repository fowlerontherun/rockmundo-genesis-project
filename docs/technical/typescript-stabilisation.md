# TypeScript stabilisation

## Result

- **Original effective error count:** 133
- **Original `npm run typecheck` reported count:** 0 (a false positive: the root solution has no input files and `tsc --noEmit` did not traverse its project references)
- **Final error count:** 0
- **Compiler projects checked:** `tsconfig.app.json` and `tsconfig.node.json`

## Baseline root-cause breakdown

| Area | Errors | Root cause |
| --- | ---: | --- |
| Third-party and test types | 32 | React Testing Library's required DOM peer was absent, so its DOM query re-exports did not exist. |
| Supabase/database types | 17 | Generated database types predated the festival-company RPC migrations. |
| API/query response validation, hooks and contexts | 78 | Festival RPC responses correctly entered as `unknown`, but parser failure branches did not preserve control-flow narrowing; one mutation result remained `unknown`. |
| React props and form values | 1 | Company creation compared its authoritative company-type union with a removed festival value. |
| Incorrect exports | 2 | Three domain modules exposed the same money-formatting name through one barrel. |
| Tests, mocks and fixtures | 1 | A festival site-plan fixture widened discriminant strings. |
| Genuine outdated code | 1 | The festival legacy page read the removed numeric record field instead of the canonical serialized value. |
| Nullable/optional values | 1 | Hashtag extraction did not first narrow an optional body to a string. |

No compiler errors were attributed directly to the shared player, character, band, gig, venue, songwriting, recording, schedule, activity, or finance entity definitions. Those flows were nevertheless included by the full application project check.

## Main changes and shared contracts

- Added the festival-company RPC signatures introduced by migrations to the generated Supabase `Functions` map, with `unknown` response boundaries so every response must pass the existing domain parser.
- Kept festival configuration, site plan, ticket plan, artist programme, operations, and settlement types in their domain modules. The feature barrel now explicitly re-exports those authoritative types without ambiguous formatter exports.
- Added a recursive JSON serializer for typed festival mutation payloads rather than asserting domain interfaces to Supabase `Json`.
- Made malformed-response branches explicit terminating returns, allowing TypeScript to retain the same runtime guards as compile-time narrowing.
- Typed operations action results through the hook and corrected the legacy record rendering and optional hashtag handling defects.
- Added the missing React Testing Library DOM peer dependency.

## Modules changed

- Festival company domain parsers, repository, hooks, exports, and test fixture
- Generated Supabase database function types
- Company creation form
- Festival legacy archive page
- Twaater trending service
- Package scripts/dependencies and CI typecheck gate

## Runtime defects discovered

1. Festival legacy records attempted to render a non-existent `value` property. They now parse the validated `valueText` field for locale formatting.
2. Optional Twaater bodies are narrowed before hashtag matching, preventing string operations on an absent body.
3. Festival mutation payload conversion now rejects non-JSON values at the RPC boundary instead of relying on an unchecked assertion.
4. The previous typecheck script and CI step were false-positive checks; the command now compiles both real TypeScript projects.

## Intentionally excluded follow-up

- No database schema, gameplay balance, routes, or user-facing feature design changed.
- Existing permissive compiler settings were not tightened as part of this focused zero-error pass. Enabling `strictNullChecks`, `noImplicitAny`, and unused-code checks should be handled incrementally in dedicated follow-up work.
- Database-backed integration gates still require their documented Supabase CLI and database environment; this pass does not replace those external prerequisites.
