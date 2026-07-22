import { describe, expect, it } from "vitest";
import { buildReadiness } from "../components/FestivalOperationalReadiness";
import { validateStageForm } from "../components/FestivalStageManagement";
import { buildSlotPreview } from "../components/FestivalStageSchedule";
import { filterCandidates } from "../components/FestivalStaffManagement";
import { permitApplicationStatus, permitRequirementCode, permitStateLabel } from "../components/FestivalPermitManagement";
import { isQuoteExpired } from "../components/FestivalInsuranceManagement";
import { calculateFinanceSummary } from "../components/FestivalFinanceManagement";
import { canManage, lifecycleReadOnly } from "../components/managementUtils";

describe("festival owner operations dashboard models", () => {
  it("calculates edition dashboard readiness statuses", () => {
    const readiness = buildReadiness({ stages: [{ id: "s1" }], slots: [{ id: "slot", stage_id: "s1" }], staff: [], permit_requirements: [], insurance_quotes: [], insurance_policies: [] });
    expect(readiness.find((item) => item.key === "stages")?.status).toBe("complete");
    expect(readiness.find((item) => item.key === "staff")?.nextAction).toBe("Hire missing staff");
  });

  it("validates the stage form inline", () => {
    expect(validateStageForm({ name: "", capacity: 0, changeoverDuration: 1, curfew: "late" })).toMatchObject({ name: expect.any(String), capacity: expect.any(String), curfew: expect.any(String) });
    expect(validateStageForm({ name: "Main", capacity: 500, changeoverDuration: 20, curfew: "23:00" })).toEqual({});
  });

  it("maps slot preview templates from generation input", () => {
    const preview = buildSlotPreview({ date: "2030-06-01", openingTime: "18:00", curfew: "20:00", setLength: 45, changeover: 15, headline: true, intermission: false });
    expect(preview[0]).toMatchObject({ type: "opener", start_time: "18:00", duration_minutes: 45 });
  });

  it("filters persistent staff candidates", () => {
    const candidates = [{ id: "a", role: "security", skill: "crowd", wage_cents: 12000, availability: "available" }, { id: "b", role: "medic", skill: "first aid", wage_cents: 30000, availability: "busy" }];
    expect(filterCandidates(candidates, { role: "security", skill: "crowd", wage: "150", availability: "available" }).map((c) => c.id)).toEqual(["a"]);
  });

  it("labels owner permit states", () => {
    expect(permitStateLabel("information_requested")).toBe("More information required");
    expect(permitStateLabel("more_information_required")).toBe("More information required");
    expect(permitStateLabel("expired")).toBe("Expired");
  });

  it("normalises permit requirement rows from edition operations", () => {
    expect(permitRequirementCode({ permit_type: "public_event" })).toBe("public_event");
    expect(permitApplicationStatus({ status: "required" })).toBe("not_started");
    expect(permitApplicationStatus({ status: "required", current_application: { id: "permit-1", status: "pending" } })).toBe("pending");
  });

  it("detects insurance quote expiry", () => {
    expect(isQuoteExpired({ quote_expires_at: "2020-01-01T00:00:00Z" }, new Date("2021-01-01T00:00:00Z").getTime())).toBe(true);
  });

  it("calculates finance summary profit", () => {
    expect(calculateFinanceSummary({ cost_categories: [{ committed_cents: 4000 }], income_categories: [{ forecast_cents: 10000 }], received_income_cents: 9000, paid_costs_cents: 3000 })).toEqual({ forecastProfit: 6000, actualProfit: 6000 });
  });

  it("honours permission-based actions", () => {
    expect(canManage({ stageManager: true }, "stages")).toBe(true);
    expect(canManage({ talentBooker: true }, "insurance")).toBe(false);
    expect(canManage({ financeManager: true }, "insurance")).toBe(true);
  });

  it("applies lifecycle restrictions", () => {
    expect(lifecycleReadOnly("live")).toBe(true);
    expect(lifecycleReadOnly("planning")).toBe(false);
  });
});
