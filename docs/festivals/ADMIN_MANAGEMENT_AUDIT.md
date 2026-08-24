# Festival admin and owner management audit

## Final route model

- Primary admin route: `/admin/festivals`.
- Legacy `/admin/city-festivals` redirects to `/admin/festivals`.
- Primary owner route: `/festivals/:festivalId/manage`.
- Edition deep link: `/festivals/:festivalId/manage/editions/:editionId`.

## Surface inventory

| Surface | Data source | Writes before this PR | Lifecycle owner | Security model | Duplicate functionality | Migration action | Final retained route |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/pages/admin/FestivalsAdmin.tsx` | Legacy `game_events`, `festival_participants`, hybrid stages | Created, edited and deleted `game_events` festival occurrences | Browser-owned occurrence status | Authenticated client writes | City editor, detail manager, invite manager | Replaced with canonical catalogue powered by `admin_festival_catalogue()` | `/admin/festivals` |
| `src/pages/admin/CityFestivalsAdmin.tsx` | Permanent `festivals` rows with occurrence fields | Direct browser updates to dates, attendance, prices and scale | Brand row | Authenticated client writes | Admin festival creation and seeding | Retired direct editor; route redirects to canonical admin workspace | `/admin/festivals` |
| `src/pages/FestivalOwnerConsole.tsx` | Mixed brand, current edition and brand-scoped operations | Direct staff, permit, insurance, ledger and stage writes | Implicit current edition | Owner check in React plus broad Supabase access | Booking workspace and admin operations | Refactored to explicit edition selector and edition-scoped read-only summaries | `/festivals/:festivalId/manage/editions/:editionId` |
| `src/pages/FestivalRunWizard.tsx` | Canonical live/performance data | Starts/runs performance flow | Performance session service | Existing organiser/session checks | Live admin tab | Retain as live-operation workflow; link from edition workspace | Edition Live tab |
| `src/components/festivals/admin/FestivalDetailManager.tsx` | Hybrid stages/slots, legacy finance/quality | Browser-created stages, slots, direct band assignment, NPC DJs | Browser | Authenticated client writes | Owner operations and admin stage tools | Superseded by edition-scoped operations and audited system-act RPCs | Not mounted by admin page |
| `src/components/festivals/FestivalInviteManager.tsx` | Legacy invite path | Legacy invitations/participants | Browser | Authenticated client writes | Canonical applications/offers/contracts | Superseded by canonical booking workspace | Booking tab |
| `src/components/festivals/admin/FestivalLifecycleControls.tsx` | Canonical lifecycle options and transition RPC | Transition RPC | Canonical transition RPC | Server-authorised; legal graph cannot be bypassed | New lifecycle tab | Retain; blackout blockers and explicit admin override are server projected and audited | Lifecycle tab |
| `src/features/festivals/scheduling/components/FestivalArtistScheduleFinaliser.tsx` | Accepted artist booking queue, canonical contracts and stage slots | No accepted-booking propagation control | Canonical booking finaliser RPC | Organiser/delegated role checks; idempotent | Phase 2B placeholder | Retain as the explicit accepted booking → contract → slot action | Schedule workspace |
| `src/features/festivals/admin/components/FestivalAuditLog.tsx` | Platform audit plus permission-checked edition audit RPC | Platform-only audit filtering | Append-only organiser/admin audit stream | Admin/owner/delegated read boundary | Separate lifecycle/contract/application event logs | Retain one edition audit projection with before/after evidence | Advanced admin tab |
| `src/pages/FestivalMarketplace.tsx` | Public/canonical festival listings | Marketplace actions | Marketplace service | Player permissions | Directory/detail | Retain public acquisition surface; no admin writes | Public marketplace |
| `src/pages/FestivalDetail.tsx` | Public festival projection | Public interactions only | Canonical public lifecycle | Public-safe reads | Directory | Keep canonical edition public page | Public detail |
| `src/pages/FestivalDirectory.tsx` | Public directory | None | Canonical public lifecycle | Public-safe reads | Marketplace | Keep directory | Public directory |
| Admin route registration | React routes | Mounted two admin pages | N/A | Admin shell | Duplicate admin routes | City route redirects to primary admin route | `/admin/festivals` |
| Admin navigation | Admin shell links | Navigation only | N/A | Admin shell | City editor link | Point to primary admin workspace | `/admin/festivals` |
| Edition services | `festival_editions` RPCs | Canonical edition creation/update | Server | RPC/RLS | Owner console direct derivation | Reuse and extend with admin catalogue and owner edition options | Shared service |
| Performance-session organiser UI | `festival_performance_sessions` | Session create/run actions | Canonical session service | Server checks | Run wizard/live tab | Retain under edition Live tab | Edition workspace |
| Outcome dashboards | PR #1200 outcome tables | Admin invalidation only | Outcome RPC | Server audited | Owner console stats | Owners read outcomes; admins invalidate through audited RPC | Outcomes tab |

## Risk summary

The removed legacy admin path could create festival occurrences without a permanent canonical brand, dated edition, lifecycle events, stage-slot reservations, contracts, sessions or outcome integration. The retained model makes legacy records visible only through mappings and migration previews while new lifecycle, application, booking and performance writes use canonical server-authoritative boundaries.

## 2029-12-12 operational completion update

The canonical edition operations PR completes the PR #1210 foundation by adding edition-scoped operational RPCs, deterministic operational backfill, migration issues, persistent system acts, persistent staff candidates, permit and insurance workflows, controlled ledger posting, data-health repairs, legacy migration apply, and expanded settlement readiness. Career effects and final financial settlement were subsequently completed by backlog B4.

## B5 organiser lifecycle closure

Backlog B5 closes the remaining organiser lifecycle and audit authority gaps:

- `festival_regional_blackouts` is the canonical dated city/region/country blackout source. Advancing an edition into application, booking, announcement, on-sale, setup or live state fails closed while a blackout overlaps the edition.
- Lifecycle options are projected from the same `validate_festival_edition_transition` graph used by mutations. The UI no longer advertises shortcuts such as `live → completed` that the canonical state machine rejects.
- A platform administrator may explicitly override an active blackout only for an otherwise legal transition, with a required reason and blackout evidence retained in the audit metadata. Override cannot bypass the lifecycle graph.
- Postponement moves active contracts to amendment-required state and pauses active ticket sales. Cancellation releases reservations, marks contracts settlement-required, cancels public launch artefacts, queues eligible ticket refund obligations and notifies ticket holders and performers.
- Festival application submission now evaluates artist type, fame bounds, genre rules and active band-member limits from server-side facts before accepting the application.
- Accepted band bookings waiting for scheduling are exposed through a permission-checked queue. Finalisation creates one active canonical contract, immutable contract version, confirmed stage slot, reservation and booking link with a stable idempotency key.
- Solo/NPC accepted bookings remain visible but fail closed rather than being coerced into the band-only canonical performance-contract schema. A future generic artist-contract authority can extend this boundary without corrupting the current contract model.
- `festival_admin_audit_events` is immutable for normal operation and is projected through `get_festival_edition_audit_log`, giving authorised organisers/admins one edition-level timeline with actor, reason and before/after evidence.

B5 therefore uses the canonical edition, booking, launch, ticket and performance foundations rather than reactivating the superseded legacy festival management paths.
