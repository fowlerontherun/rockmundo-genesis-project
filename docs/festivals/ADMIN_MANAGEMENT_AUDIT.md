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
| `src/components/festivals/admin/FestivalLifecycleControls.tsx` | Canonical lifecycle helper | Transition RPC | Canonical transition RPC | Server-authorised | New lifecycle tab | Retain logic, require admin reason and audit via `admin_transition_festival_edition` | Lifecycle tab |
| `src/pages/FestivalMarketplace.tsx` | Public/canonical festival listings | Marketplace actions | Marketplace service | Player permissions | Directory/detail | Retain public acquisition surface; no admin writes | Public marketplace |
| `src/pages/FestivalDetail.tsx` | Public festival projection | Public interactions only | Canonical public lifecycle | Public-safe reads | Directory | Keep canonical edition public page | Public detail |
| `src/pages/FestivalDirectory.tsx` | Public directory | None | Canonical public lifecycle | Public-safe reads | Marketplace | Keep directory | Public directory |
| Admin route registration | React routes | Mounted two admin pages | N/A | Admin shell | Duplicate admin routes | City route redirects to primary admin route | `/admin/festivals` |
| Admin navigation | Admin shell links | Navigation only | N/A | Admin shell | City editor link | Point to primary admin workspace | `/admin/festivals` |
| Edition services | `festival_editions` RPCs | Canonical edition creation/update | Server | RPC/RLS | Owner console direct derivation | Reuse and extend with admin catalogue and owner edition options | Shared service |
| Performance-session organiser UI | `festival_performance_sessions` | Session create/run actions | Canonical session service | Server checks | Run wizard/live tab | Retain under edition Live tab | Edition workspace |
| Outcome dashboards | PR #1200 outcome tables | Admin invalidation only | Outcome RPC | Server audited | Owner console stats | Owners read outcomes; admins invalidate through audited RPC | Outcomes tab |

## Risk summary

The removed legacy admin path could create festival occurrences without a permanent canonical brand, dated edition, lifecycle events, stage-slot reservations, contracts, sessions or outcome integration. The new model makes legacy records visible only through mappings and migration previews while all new writes go through canonical RPCs.
