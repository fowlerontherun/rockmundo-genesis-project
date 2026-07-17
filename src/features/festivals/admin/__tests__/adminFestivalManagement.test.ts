import { describe, expect, it } from "vitest";
import { formatFestivalMoney, mapCatalogueRow, mapOwnerEdition } from "../mappers";
import { projectFestivalPermissions } from "../permissions";
import { selectPreferredFestivalEdition } from "@/features/festivals/admin/components/workspace/selectPreferredFestivalEdition";

describe("canonical festival admin management", () => {
  it("keeps brand and edition fields separated in catalogue mapping", () => {
    const row = mapCatalogueRow({ festival_id: "brand-1", brand_name: "RockMundo", current_edition_id: "edition-1", current_edition_title: "RockMundo 2027", edition_count: 2, stage_count: 0, active_contract_count: 0, performance_session_count: 0, outcome_count: 0, currency_code: "EUR", data_health_warnings: [{ code: "edition_without_stages", severity: "warning", message: "No stages" }] });
    expect(row.festivalId).toBe("brand-1");
    expect(row.currentEditionId).toBe("edition-1");
    expect(row.dataHealthWarnings).toHaveLength(1);
  });

  it("maps explicit owner edition selections", () => {
    const edition = mapOwnerEdition({ id: "edition-1", festival_id: "brand-1", title: "Summer 2027", edition_number: 3, status: "planning", currency_code: "GBP" });
    expect(edition.festivalId).toBe("brand-1");
    expect(edition.editionNumber).toBe(3);
  });

  it("projects delegated permissions by role", () => {
    expect(projectFestivalPermissions(["talent_booker"]).manageLineup).toBe(true);
    expect(projectFestivalPermissions(["talent_booker"]).manageFinance).toBe(false);
    expect(projectFestivalPermissions(["platform_admin"]).manageLifecycle).toBe(true);
  });

  it("formats currencies without assuming USD", () => {
    expect(formatFestivalMoney(12345, "EUR")).toContain("123");
  });
});

describe("festival admin edition selection", () => {
  const edition = (id: string, status: any, endAt = `2027-01-0${id}`) => ({ id, festivalId: "festival-1", title: id, editionNumber: Number(id), status, startAt: null, endAt, cityName: null, currencyCode: "USD" });

  it("selects live, then upcoming, then most recently completed, then first available edition", () => {
    expect(selectPreferredFestivalEdition([edition("1", "completed"), edition("2", "live")])?.id).toBe("2");
    expect(selectPreferredFestivalEdition([edition("1", "completed"), edition("2", "planning")])?.id).toBe("2");
    expect(selectPreferredFestivalEdition([edition("1", "completed", "2027-01-01"), edition("2", "completed", "2027-02-01")])?.id).toBe("2");
    expect(selectPreferredFestivalEdition([edition("1", "cancelled")])?.id).toBe("1");
  });
});
