# Festival V2 public runtime cutover — canonical edition architecture

Status: **Minimal public-safe canonical projection deployed 29 October 2026.** Stage-specific live activity and crowd authority remain P1 follow-ups. Prepared 28 October 2026.
Issue: #4687. Related: #4072, #4633, #4650 and draft PR #4688.

## Verified production reality

Read-only Supabase audit of project `rockmundo`:

| Capability | Present | Implication |
| --- | --- | --- |
| `festival_editions_v2`, `festival_edition_runtimes` | Yes (2 runtime records) | **Existing authority** for annual editions |
| `festival_runtime_configuration_versions`, `festival_runtime_evidence` | Yes | Keep canonical replay/settlement evidence |
| `get_festival_edition_runtime_control_room(uuid,uuid)` | Yes | Owner-authorised **private** control room, never expose to public |
| `get_public_festival(text)` | Yes | Public festival discovery already exists |
| `get_public_festival_edition_live_status(text)` | **Yes, deployed 2026-10-29** | Public-safe canonical runtime projection, migration `20261029091653` |
| `festival_public_editions`, `festival_runtime_sessions`, `festival_runtime_days` | No | Different, launch-scoped 2029 migration sequence not deployed |
| `festival_runtime_stage_crowds`, `get_public_festival_live_status(text)`, `get_public_festival_live_experience(text)` | No | Existing Festival V2 visitor live widgets lack their public RPC |

Migration history contained 1,735 recorded versions, ending at `20261028133000` at the time of audit. Do **not** treat migration filenames or recorded versions alone as proof an object exists. Run `supabase/tests/festival_runtime_production_preflight.sql` against each environment.

## Architecture decision

1. Treat `festival_edition_runtimes` as canonical. Preserve its one-active-runtime invariant, append-only evidence, replay, membership permissions, gates and settlement.
2. **Do not apply** the future-dated launch-scoped `2029121719*`, `2029121720*`, `2029121721*` migration chain just to create an RPC for the visitor hub. It is a separate runtime model.
3. Do not expose or repackage `get_festival_edition_runtime_control_room` to anonymous users. It is deliberately owner-authorised and can contain operational details.
4. Implement a new minimal public projection from *canonical edition* identifiers, gated by actually published edition visibility and the source data's event/day. Expose only approved fields.
5. Reconcile identity separately: the existing visitor UI expects `festivalLaunchId` from the undeployed public launch model, while the annual-edition runtime uses `editionId`. Never pretend these UUIDs are interchangeable.

## Public read contract (minimal version deployed)

The deployed endpoint `get_public_festival_edition_live_status(p_slug text)` returns only the current approved subset. The richer fields below remain design work:

- **Deployed:** `festivalLaunchId`, `editionId`, `runtimeStatus`, `gatesStatus`, `currentDay`, `updatedAt`, a festival-wide attendance band, and festival-day preserved weather when available.
- **Pending:** Public stage identifiers, confirmed performances, cancellations and delays. The deployed endpoint returns an empty `performances` array instead of inventing stage activity.
- **Deployed:** Weather state only from the festival-day-preserved runtime sequence. Ground conditions remain absent unless verified.
- **Pending:** Stage-specific crowd and mood bands, with verified timestamps and stable stage IDs. The deployed endpoint returns an empty `stageCrowds` array. Never infer exact headcounts, queues or safety pressure.
- **Pending:** Public alerts with approved redaction. The deployed endpoint returns empty `messages` and exposes no private incident details.

Return no live content for unpublished editions or when no applicable runtime/current day exists. Limit access, payload sizes and refresh frequency. No browser mutations.

## Security and rollout gates

- [x] Verify published slug → launch → canonical edition mapping. Stable stage-specific IDs remain a follow-up.
- [x] Verify anonymous / authenticated function EXECUTE permissions, empty `search_path`, revocation of default PUBLIC execute and rejection of unknown/private slugs.
- [x] Add and execute production-safe SQL contract harness for existing published edition identity, unknown slugs, privacy redaction and off-day suppression. Full multi-day / private disposable fixtures remain pending.
- [x] Use the canonical contract in visitor hooks, with one shared polling query, edition identity verification, empty-state fallback and null-safe follow-up PR #4693.
- [ ] Run disposable integration fixture/harness, typecheck, lint and browser/mobile tests.
- [x] Apply additive function-only migration `20261029091653` directly in production after rollback-only smoke/anon tests. Verify live response, ACL, no PUBLIC grant and no changes to existing runtime rows.
- [ ] Resolve old launch-scoped crowd-day patch PR #4688 independently. Its reconciliation script is only for environments where the complete *launch-scoped* runtime exists.
- [ ] Confirm no duplicate attendance, payouts or festival runtime processing.

## Operations

The repository preflight is a **read-only SELECT** that reports which authority is available and blocks unsafe launch-scoped patching. It does not install tables or mark migrations as applied. The existing production annual-edition runtime must remain in place throughout the cutover.

The public-safe canonical projection is now deployed. The visitor hub may show its verified runtime state, gates, active-day attendance band and weather. It must continue to withhold unsupported stage-level bands, artist status or environmental data. Frontend deployment and browser QA must still be verified independently.
