# Festival V2 public runtime cutover — canonical edition architecture

Status: **P1 blocked on new public-safe projection**. Prepared 28 October 2026.
Issue: #4687. Related: #4072, #4633, #4650 and draft PR #4688.

## Verified production reality

Read-only Supabase audit of project `rockmundo`:

| Capability | Present | Implication |
| --- | --- | --- |
| `festival_editions_v2`, `festival_edition_runtimes` | Yes (2 runtime records) | **Existing authority** for annual editions |
| `festival_runtime_configuration_versions`, `festival_runtime_evidence` | Yes | Keep canonical replay/settlement evidence |
| `get_festival_edition_runtime_control_room(uuid,uuid)` | Yes | Owner-authorised **private** control room, never expose to public |
| `get_public_festival(text)` | Yes | Public festival discovery already exists |
| `festival_public_editions`, `festival_runtime_sessions`, `festival_runtime_days` | No | Different, launch-scoped 2029 migration sequence not deployed |
| `festival_runtime_stage_crowds`, `get_public_festival_live_status(text)`, `get_public_festival_live_experience(text)` | No | Existing Festival V2 visitor live widgets lack their public RPC |

Migration history contained 1,735 recorded versions, ending at `20261028133000` at the time of audit. Do **not** treat migration filenames or recorded versions alone as proof an object exists. Run `supabase/tests/festival_runtime_production_preflight.sql` against each environment.

## Architecture decision

1. Treat `festival_edition_runtimes` as canonical. Preserve its one-active-runtime invariant, append-only evidence, replay, membership permissions, gates and settlement.
2. **Do not apply** the future-dated launch-scoped `2029121719*`, `2029121720*`, `2029121721*` migration chain just to create an RPC for the visitor hub. It is a separate runtime model.
3. Do not expose or repackage `get_festival_edition_runtime_control_room` to anonymous users. It is deliberately owner-authorised and can contain operational details.
4. Implement a new minimal public projection from *canonical edition* identifiers, gated by actually published edition visibility and the source data's event/day. Expose only approved fields.
5. Reconcile identity separately: the existing visitor UI expects `festivalLaunchId` from the undeployed public launch model, while the annual-edition runtime uses `editionId`. Never pretend these UUIDs are interchangeable.

## Proposed public read contract (not deployed)

Use an explicitly edition-scoped endpoint, e.g. `get_public_festival_edition_live_status(p_slug text)` returning JSON with:

- `editionId`, `runtimeState`, `currentDay`, `updatedAt`.
- Public stage identifiers and names, currently confirmed performance status / cancelled/delayed summary, with no artist check-in or backstage security details.
- Weather/ground conditions only from published runtime snapshots.
- Festival-wide attendance band and stage crowd/mood band **only when derived from the current festival day and with a timestamp**. Never infer exact headcounts, queue lengths or safety pressure.
- An approved public alert summary that excludes private security, medical, personnel and contract details.

Return no live content for unpublished editions or when no applicable runtime/current day exists. Limit access, payload sizes and refresh frequency. No browser mutations.

## Security and rollout gates

- [ ] Confirm published edition-to-slug mapping and canonical stage IDs; avoid joining on stage names.
- [ ] Confirm anonymous visibility policy and function execution grants (review `SECURITY DEFINER`, search_path and underlying RLS).
- [ ] Add SQL contract harness: published vs unpublished, cross-edition IDs, zero/one/multi-day, no future/previous-day stage crowds, privacy redaction, no owner-only fields, stable times.
- [ ] Implement domain parser and visitor UI against the canonical contract. Keep absent-data fallback and disable automatic polling on missing RPCs.
- [ ] Run disposable integration fixture/harness, typecheck, lint and browser/mobile tests.
- [ ] Back up, review and apply **forward-only** migration to intended environment; verify in database, not only in the repo.
- [ ] Resolve old launch-scoped crowd-day patch PR #4688 independently. Its reconciliation script is only for environments where the complete *launch-scoped* runtime exists.
- [ ] Confirm no duplicate attendance, payouts or festival runtime processing.

## Operations

The repository preflight is a **read-only SELECT** that reports which authority is available and blocks unsafe launch-scoped patching. It does not install tables or mark migrations as applied. The existing production annual-edition runtime must remain in place throughout the cutover.

Until a public-safe canonical projection exists, the festival visitor hub must say that live information is unavailable; it must not guess live bands, crowd occupancy, weather or performance outcomes.
