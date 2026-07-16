import type { AdminFestivalCatalogueRow, FestivalDataHealthIssue, OwnerEditionOption } from "./types";

const issueFromUnknown = (value: unknown): FestivalDataHealthIssue[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FestivalDataHealthIssue => {
    const candidate = item as Partial<FestivalDataHealthIssue>;
    return typeof candidate.code === "string" && typeof candidate.message === "string" && (candidate.severity === "warning" || candidate.severity === "blocker");
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
