import { describe, expect, it } from "vitest";
import { buildFestivalDashboardModel, isInsurancePolicyActiveForEdition } from "./buildFestivalDashboardModel";

const edition = (overrides = {}) => ({ id: "ed", festivalId: "fest", title: "Summer Noise 2027", editionNumber: 1, status: "planning" as const, startAt: "2027-08-01T12:00:00Z", endAt: "2027-08-03T23:00:00Z", cityName: "London", currencyCode: "GBP", ...overrides });
const slot = (id: string, extra = {}) => ({ id, band_id: `band-${id}`, contract_status: "signed", ...extra });
const build = (overrides: Partial<Parameters<typeof buildFestivalDashboardModel>[0]> = {}) => buildFestivalDashboardModel({ now: new Date("2027-06-20T12:00:00Z"), festivalName: "Summer Noise", edition: edition(), operations: {}, ...overrides });

describe("buildFestivalDashboardModel", () => {
  it("handles brand-new editions with no stages or slots", () => { const m = build({ operations: {} }); expect(m.stageCount).toBe(0); expect(m.availableSlots).toBe(0); expect(m.nextAction?.destination).toBe("#stages"); });
  it("handles stages but no slots", () => { const m = build({ operations: { stages: [{ id: "stage" }] } }); expect(m.checks.find(c=>c.key==="slots")?.status).toBe("blocked"); });
  it("calculates partially filled lineup", () => { const m = build({ operations: { stages: [{}], slots: [slot("1"), { id: "2" }] } }); expect(m.bookedActs).toBe(1); expect(m.lineupPercent).toBe(50); });
  it("calculates fully configured lineup", () => { const m = build({ operations: { stages: [{}], slots: [slot("1"), slot("2")], staff: [{}], insurance_policies: [{ policy_status: "active" }] }, finance: { approved_budget_cents: 10000 } }); expect(m.checks.find(c=>c.key==="lineup")?.status).toBe("complete"); });
  it("distinguishes missing ticket data", () => { const m = build({ operations: {} }); expect(m.capacity).toBeNull(); expect(m.ticketSalesPercent).toBeNull(); });
  it("allows zero tickets with valid capacity", () => { const m = build({ operations: { ticket_summary: { capacity: 100, tickets_sold: 0 } } }); expect(m.ticketsSold).toBe(0); expect(m.ticketSalesPercent).toBe(0); });
  it("marks missing finance query unavailable", () => { const m = build({ financeUnavailable: true }); expect(m.unavailableSections.some(s=>s.key==="finance")).toBe(true); });

  it("reads deployed finance summary fields before legacy aliases", () => { const m = build({ finance: { budget_cents: 15000, committed_cost_cents: 4000, currency: "EUR" } }); expect(m.approvedBudgetMinor).toBe(15000); expect(m.committedCostMinor).toBe(4000); expect(m.remainingBudgetMinor).toBe(11000); expect(m.budgetUsedPercent).toBe(27); expect(m.currencyCode).toBe("EUR"); });
  it("marks operations-derived checks unavailable when operations fail", () => { const m = build({ operationsUnavailable: true, finance: { budget_cents: 15000 } }); expect(["stages", "slots", "lineup", "contracts", "tickets", "staff", "permits", "insurance"].every((key) => m.checks.find((c) => c.key === key)?.status === "unavailable")).toBe(true); expect(m.readinessPercent).toBe(100); });
  it("does not mark missing permit records as complete unless explicitly not required", () => { expect(build({ operations: {} }).checks.find((c) => c.key === "permits")?.status).toBe("not_started"); expect(build({ operations: { permits_not_required: true } }).checks.find((c) => c.key === "permits")?.status).toBe("complete"); });
  it("requires active insurance covering edition dates", () => { const expired = build({ operations: { insurance_policies: [{ policy_status: "expired", coverage_start_at: "2026-01-01", coverage_end_at: "2026-12-31" }] } }); const active = build({ operations: { insurance_policies: [{ policy_status: "active", coverage_start_at: "2027-01-01", coverage_end_at: "2027-12-31" }] } }); expect(expired.checks.find((c) => c.key === "insurance")?.status).toBe("blocked"); expect(active.checks.find((c) => c.key === "insurance")?.status).toBe("complete"); });
  it("flags zero approved budget", () => { const m = build({ finance: { approved_budget_cents: 0, committed_costs_cents: 0 } }); expect(m.checks.find(c=>c.key==="budget")?.status).toBe("blocked"); });
  it("maps completed festival", () => { expect(build({ edition: edition({ status: "completed" }) }).editionStatus).toBe("completed"); });
  it("maps cancelled festival", () => { expect(build({ edition: edition({ status: "cancelled" }) }).editionStatus).toBe("cancelled"); });
  it("keeps unknown lifecycle visible", () => { const m = build({ edition: edition({ status: "mystery" }) }); expect(m.editionStatus).toBe("unknown"); expect(m.warnings[0].key).toBe("unknown_status"); });
  it("handles missing dates", () => { expect(build({ edition: edition({ startAt: null, endAt: null }) }).daysUntilStart).toBeNull(); });
  it("reports negative days after start", () => { expect(build({ now: new Date("2027-08-02T12:00:00Z") }).daysUntilStart).toBeLessThan(0); });
  it("omits absent sponsor and reputation data", () => { const m = build({ operations: {} }); expect(m.sponsorCount).toBeNull(); expect(m.reputation).toBeNull(); });
  it("uses only valid checklist destinations", () => { const valid = new Set(["#lineup", "#schedule", "#stages", "#staff", "#permits", "#insurance", "#finance", "#operations", "#settings"]); expect(build({}).checks.every(c=>valid.has(c.destination))).toBe(true); });
  it("never returns non-finite percentages", () => { const m = build({ operations: { ticket_summary: { capacity: 0, tickets_sold: 0 }, slots: [] }, finance: { approved_budget_cents: 0, committed_costs_cents: 0 } }); expect([m.ticketSalesPercent, m.lineupPercent, m.budgetUsedPercent].every(v=>v===null || Number.isFinite(v))).toBe(true); });
});


describe("canonical insurance coverage matching", () => {
  const complete = (policy: Record<string, unknown>) => build({ operations: { insurance_policies: [policy] } }).checks.find((c) => c.key === "insurance")?.status;

  it("recognises canonical active pending-payment policies", () => {
    expect(complete({ active: true, policy_status: "pending_payment", effective_from: "2027-07-25", effective_to: "2027-08-10" })).toBe("complete");
  });

  it("recognises accepted active statuses with valid dates", () => {
    expect(complete({ policy_status: "in_force", effective_from: "2027-07-01T00:00:00Z", effective_to: "2027-08-04T00:00:00Z" })).toBe("complete");
  });

  it("rejects inactive flags without an active status", () => {
    expect(complete({ active: false, policy_status: "pending_payment", effective_from: "2027-07-01", effective_to: "2027-08-04" })).toBe("blocked");
  });

  it("rejects explicitly cancelled policies even when active is true", () => {
    expect(complete({ active: true, policy_status: "cancelled", effective_from: "2027-07-01", effective_to: "2027-08-04" })).toBe("blocked");
  });

  it("rejects expired policies", () => {
    expect(complete({ active: true, policy_status: "expired", effective_from: "2027-07-01", effective_to: "2027-08-04" })).toBe("blocked");
  });

  it("rejects policies beginning after the edition starts", () => {
    expect(complete({ active: true, policy_status: "pending_payment", effective_from: "2027-08-02T00:00:00Z", effective_to: "2027-08-04T00:00:00Z" })).toBe("blocked");
  });

  it("rejects policies ending before the edition finishes", () => {
    expect(complete({ active: true, policy_status: "pending_payment", effective_from: "2027-07-01T00:00:00Z", effective_to: "2027-08-03T12:00:00Z" })).toBe("blocked");
  });

  it("allows missing canonical boundaries as open ended but not invalid boundaries", () => {
    expect(isInsurancePolicyActiveForEdition({ active: true, policy_status: "pending_payment" }, "2027-08-01T12:00:00Z", "2027-08-03T23:00:00Z")).toBe(true);
    expect(complete({ active: true, policy_status: "pending_payment", effective_from: "not-a-date", effective_to: "2027-08-04" })).toBe("blocked");
  });

  it("keeps insurance unavailable when operations loading fails", () => {
    expect(build({ operationsUnavailable: true, operations: { insurance_policies: [{ active: true, policy_status: "pending_payment" }] } }).checks.find((c) => c.key === "insurance")?.status).toBe("unavailable");
  });
});
