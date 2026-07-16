# Festival Feature Visibility Audit

This audit maps canonical festival features to their database, service, component, route, navigation and state handling. The executable source of truth is `src/features/festivals/festivalFeatureRegistry.ts`.

| Feature | Database objects | Service/RPC | Component | Route | Navigation | Classification | Empty/error state | Test |
|---|---|---|---|---|---|---|---|---|
| Public discovery | public_festival_editions | listPublicFestivalEditions | FestivalBrowser | /festivals | World hub | visible and functional | visible copy | route smoke |
| Public detail | public_festival_editions, mappings | getPublicFestivalEdition | FestivalDetail | /festivals/:festivalId | Festival cards | visible and functional | visible copy | route smoke |
| Applications/offers/contracts | festival_applications, offers, contracts | booking RPCs | CanonicalOrganiserBookingWorkspace | owner edition route | Booking/Lineup | visible and functional | cards explain no records | unit + smoke |
| Stages/slots | festival_stages, festival_stage_slots | stage RPCs, resolve_festival_stage_edition | FestivalOwnerConsole | owner edition route | Stages | visible and functional | lifecycle/unresolved mapping messages | SQL harness |
| Staff | festival_staff, candidates, ledger | staffing RPCs | FestivalOwnerConsole | owner edition route | Staff | visible and functional | no candidates/hired state | route smoke |
| Permits | festival_permits | permit RPCs | FestivalOwnerConsole | owner edition route | Permits | visible and functional | deadline/status explanations | route smoke |
| Insurance | festival_edition_insurance_quotes, policies | quote/purchase RPCs | FestivalOwnerConsole | owner edition route | Insurance | visible and functional | stale quote warning | route smoke |
| Finance | festival_expense_ledger | finance summary RPC | FestivalOwnerConsole | owner edition route | Finance | visible and functional | RPC failure is not zero-filled | unit |
| Live sessions | festival_performance_sessions | session RPCs | FestivalSessionPage | /festivals/sessions/:sessionId | Live | visible and functional | no active sessions | route smoke |
| Outcomes | outcome tables | outcome projections | FestivalOwnerConsole/outcome cards | owner/public routes | Outcomes | visible but read-only | pending outcomes | unit |
| Settlement | settlement tables | festival_settlement_report | settlement components | owner edition route | Settlement | visible and functional | not prepared/blockers | unit + SQL |
| Legacy records | festival_legacy_mappings, migration issues | admin catalogue/data health | FestivalsAdminPage | /admin/festivals | Legacy Records | legacy/read-only | no issues | admin smoke |
| Data health | festival_operation_migration_issues | repair RPC | FestivalsAdminPage | /admin/festivals | Data Health | visible and functional | no blockers | SQL harness |
| Audit log | festival audit tables | audit projections | FestivalsAdminPage | /admin/festivals | Audit | visible but read-only | no audit events | admin smoke |
