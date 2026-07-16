export type FestivalAudience = "player" | "owner" | "admin" | "public";
export type FestivalImplementationStatus = "visible" | "read_only" | "backend_only" | "placeholder" | "broken" | "legacy";

export interface FestivalFeatureRegistryEntry {
  id: string;
  label: string;
  description: string;
  audience: FestivalAudience[];
  route: string;
  navigationParent: string;
  requiredPermission: string;
  requiredLifecycleStates: string[];
  implementationStatus: FestivalImplementationStatus;
  visibilityCondition: string;
  component: string;
  emptyState: string;
  errorState: string;
}

const owner = ["planning", "applications_open", "booking", "setup", "live", "settling", "completed"];

export const festivalFeatureRegistry: FestivalFeatureRegistryEntry[] = [
  ["public-discovery","Public discovery","Players browse public canonical festival editions.",["player","public"],"/festivals","World","none",[],"visible","public route is mounted","FestivalBrowser","No public editions yet.","Festival list failed to load."],
  ["public-detail","Public detail","Players inspect a specific festival edition or compatible legacy detail.",["player","public"],"/festivals/:festivalId","World > Festivals","none",[],"visible","deep links preserved","FestivalDetail","Festival details are not published yet.","Festival detail failed to load."],
  ["applications","Applications","Bands apply to editions while applications are open.",["player","owner"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Booking","festival_owner",["applications_open","booking"],"visible","booking workspace loaded","CanonicalOrganiserBookingWorkspace","No applications yet.","Applications failed to load."],
  ["offers","Offers","Owners review and issue booking offers.",["owner"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Booking","festival_owner",["applications_open","booking"],"visible","booking workspace loaded","CanonicalOrganiserBookingWorkspace","No offers yet.","Offers failed to load."],
  ["contracts","Contracts","Confirmed contracts and settlement obligations.",["owner","player"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Lineup","festival_owner",["booking","setup","live","settling","completed"],"visible","lineup tab visible","CanonicalOrganiserBookingWorkspace","No contracts yet.","Contracts failed to load."],
  ["setlists","Setlists","Band setlist readiness for booked performances.",["player","owner"],"/setlists","Band","band_member",["booking","setup","live"],"read_only","linked from booking/schedule","SetlistManager","No setlist submitted.","Setlist readiness unavailable."],
  ["owner-editions","Owner editions","Edition selector and lifecycle overview.",["owner"],"/festivals/:festivalId/manage/editions/:editionId","Owned assets","festival_owner",owner,"visible","authorised edition returned","FestivalOwnerConsole","Choose an edition.","Edition options failed to load."],
  ["stages","Stages","Create, edit, archive stages and manage slots.",["owner","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Stages","stage_manager",["planning","applications_open","booking","setup"],"visible","canonical RPC available","FestivalOwnerConsole","No stages yet; create a stage.","Stage RPC failed or legacy mapping unresolved."],
  ["slots","Slots","Generate, preview and maintain safe stage slots.",["owner","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Stages","stage_manager",["planning","applications_open","booking","setup"],"visible","stage resolved to edition","FestivalOwnerConsole","No slots generated yet.","Slot consistency validation failed."],
  ["staff","Staff","Requirements, candidates, hires, shifts and wages.",["owner","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Staff","operations_manager",["planning","setup","live"],"visible","staff services available","FestivalOwnerConsole","No staff hired yet.","Staff services failed."],
  ["permits","Permits","Owner application workflow and admin review state.",["owner","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Permits","operations_manager",["planning","setup"],"visible","permit requirements loaded","FestivalOwnerConsole","No permits required yet.","Permit service failed."],
  ["insurance","Insurance","Quotes, purchases, policies and stale quote warnings.",["owner","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Insurance","finance_manager",["planning","setup"],"visible","quote RPC loaded","FestivalOwnerConsole","No quotes yet.","Insurance service failed."],
  ["finance","Finance","Budget, costs, income, profit, blockers and currency warnings.",["owner","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Finance","finance_manager",owner,"visible","finance summary RPC loaded","FestivalOwnerConsole","No ledger entries yet.","Finance RPC failed."],
  ["live-sessions","Live sessions","Performance session operations and live status.",["owner","player","admin"],"/festivals/sessions/:sessionId","Owner > Live","operations_manager",["setup","live"],"visible","session route mounted","FestivalSessionPage","No live sessions yet.","Session failed to load."],
  ["outcomes","Outcomes","Owner, band and public outcome projections.",["owner","player","public","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Outcomes","festival_view",["settling","completed"],"read_only","outcomes exist","FestivalOwnerConsole","Outcomes pending.","Outcomes failed to load."],
  ["settlement","Settlement","Readiness, progress, discrepancies and reports.",["owner","player","admin"],"/festivals/:festivalId/manage/editions/:editionId","Owner > Settlement","finance_manager",["settling","completed"],"visible","safe report RPC authorised","FestivalOwnerConsole","Settlement not prepared.","Settlement report unavailable."],
  ["legacy-records","Legacy records","Mapped game-event compatibility and repair evidence.",["admin"],"/admin/festivals","Admin > Legacy Records","admin",[],"read_only","admin catalogue visible","FestivalsAdminPage","No legacy issues.","Legacy issues failed to load."],
  ["data-health","Data health","Migration blockers, currency/category issues and repairs.",["admin"],"/admin/festivals","Admin > Data Health","admin",[],"visible","migration issue table loaded","FestivalsAdminPage","No open blockers.","Data health failed to load."],
  ["admin-catalogue","Admin catalogue","Canonical brands, editions and lifecycle workspace.",["admin"],"/admin/festivals","Admin > Catalogue","admin",[],"visible","admin route mounted","AdminFestivalCatalogue","No brands yet.","Catalogue failed to load."],
  ["audit-log","Audit log","Audited operational changes and repair actions.",["admin"],"/admin/festivals","Admin > Audit","admin",[],"read_only","audit projection available","FestivalsAdminPage","No audit events yet.","Audit failed to load."],
].map(([id,label,description,audience,route,navigationParent,requiredPermission,requiredLifecycleStates,implementationStatus,visibilityCondition,component,emptyState,errorState]) => ({ id, label, description, audience, route, navigationParent, requiredPermission, requiredLifecycleStates, implementationStatus, visibilityCondition, component, emptyState, errorState } as FestivalFeatureRegistryEntry));

export const visibleFestivalFeatures = festivalFeatureRegistry.filter((feature) => feature.implementationStatus === "visible" || feature.implementationStatus === "read_only");
