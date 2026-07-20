import type { AdminFestivalCatalogueRow, FestivalDataHealthIssue, OwnerEditionOption, OwnerManagementBootstrap } from "./types";

export const issueFromUnknown = (value: unknown): FestivalDataHealthIssue[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FestivalDataHealthIssue => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const candidate = item as Partial<FestivalDataHealthIssue>;
    return (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string" &&
      (candidate.severity === "warning" || candidate.severity === "blocker")
    );
  });
};

export function mapCatalogueRow(row: Record<string, unknown>): AdminFestivalCatalogueRow {
  return {
    festivalId: String(row.festival_id),
    brandName: String(row.brand_name ?? "Untitled festival"),
    ownerName: row.owner_name ? String(row.owner_name) : null,
    cityName: row.city_name ? String(row.city_name) : null,
    currentEditionId: row.current_edition_id ? String(row.current_edition_id) : null,
    currentEditionTitle: row.current_edition_title ? String(row.current_edition_title) : null,
    nextEditionId: row.next_edition_id ? String(row.next_edition_id) : null,
    completedEditionId: row.completed_edition_id ? String(row.completed_edition_id) : null,
    editionCount: Number(row.edition_count ?? 0),
    lifecycleState: (row.lifecycle_state as AdminFestivalCatalogueRow["lifecycleState"]) ?? null,
    stageCount: Number(row.stage_count ?? 0),
    activeContractCount: Number(row.active_contract_count ?? 0),
    performanceSessionCount: Number(row.performance_session_count ?? 0),
    outcomeCount: Number(row.outcome_count ?? 0),
    attendance: row.attendance == null ? null : Number(row.attendance),
    currencyCode: String(row.currency_code ?? "USD"),
    projectedFinanceCents: Number(row.projected_finance_cents ?? 0),
    actualFinanceCents: Number(row.actual_finance_cents ?? 0),
    legacyMappings: Number(row.legacy_mappings ?? 0),
    operationalReadiness: (row.operational_readiness as AdminFestivalCatalogueRow["operationalReadiness"]) ?? "missing_edition",
    dataHealthWarnings: issueFromUnknown(row.data_health_warnings),
  };
}

export function mapOwnerEdition(row: Record<string, unknown>): OwnerEditionOption {
  return {
    id: String(row.id),
    festivalId: String(row.festival_id),
    title: String(row.title ?? `Edition ${row.edition_number ?? ""}`),
    editionNumber: Number(row.edition_number ?? 0),
    status: row.status as OwnerEditionOption["status"],
    startAt: row.start_at ? String(row.start_at) : null,
    endAt: row.end_at ? String(row.end_at) : null,
    cityName: row.city_name ? String(row.city_name) : null,
    currencyCode: String(row.currency_code ?? "USD"),
  };
}

export function formatFestivalMoney(cents: number | null | undefined, currencyCode = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format((cents ?? 0) / 100);
}


const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function mapOwnerManagementBootstrap(row: Record<string, unknown>): OwnerManagementBootstrap {
  const authority = (row.authority && typeof row.authority === "object" ? row.authority : {}) as Record<string, unknown>;
  const festival = (row.festival && typeof row.festival === "object" ? row.festival : null) as Record<string, unknown> | null;
  const migration = (row.migration && typeof row.migration === "object" ? row.migration : {}) as Record<string, unknown>;
  return {
    status: (typeof row.status === "string" ? row.status : "rpc_unavailable") as OwnerManagementBootstrap["status"],
    inputId: row.input_id ? String(row.input_id) : null,
    identifierType: row.identifier_type ? String(row.identifier_type) : null,
    festival: festival ? { id: String(festival.id), name: String(festival.name ?? "Untitled festival"), ownerType: festival.owner_type ? String(festival.owner_type) : null, ownerProfileId: festival.owner_profile_id ? String(festival.owner_profile_id) : null } : null,
    authority: { isOwner: authority.is_owner === true, isAdmin: authority.is_admin === true, delegatedRoles: stringArray(authority.delegated_roles), canCreateEdition: authority.can_create_edition === true, canManage: authority.can_manage === true },
    editions: Array.isArray(row.editions) ? row.editions.map((edition) => mapOwnerEdition((edition ?? {}) as Record<string, unknown>)) : [],
    preferredEditionId: row.preferred_edition_id ? String(row.preferred_edition_id) : null,
    migration: { required: migration.required === true, issues: issueFromUnknown(migration.issues) },
    availableActions: stringArray(row.available_actions),
    message: row.message ? String(row.message) : null,
  };
}
