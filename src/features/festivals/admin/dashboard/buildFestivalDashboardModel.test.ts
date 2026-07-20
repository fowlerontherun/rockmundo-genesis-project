import { describe, expect, it } from "vitest";
import { buildFestivalDashboardModel } from "./buildFestivalDashboardModel";

const edition = (overrides = {}) => ({ id: "ed", festivalId: "fest", title: "Summer Noise 2027", editionNumber: 1, status: "planning" as const, startAt: "2027-08-01T12:00:00Z", endAt: "2027-08-03T23:00:00Z", cityName: "London", currencyCode: "GBP", ...overrides });
const slot = (id: string, extra = {}) => ({ id, band_id: `band-${id}`, contract_status: "signed", ...extra });
const build = (overrides: Parameters<typeof buildFestivalDashboardModel>[0]) => buildFestivalDashboardModel({ now: new Date("2027-06-20T12:00:00Z"), festivalName: "Summer Noise", edition: edition(), operations: {}, ...overrides });

describe("buildFestivalDashboardModel", () => {
  it("handles brand-new editions with no stages or slots", () => { const m = build({ operations: {} }); expect(m.stageCount).toBe(0); expect(m.availableSlots).toBe(0); expect(m.nextAction?.destination).toBe("#stages"); });
  it("handles stages but no slots", () => { const m = build({ operations: { stages: [{ id: "stage" }] } }); expect(m.checks.find(c=>c.key==="slots")?.status).toBe("blocked"); });
  it("calculates partially filled lineup", () => { const m = build({ operations: { stages: [{}], slots: [slot("1"), { id: "2" }] } }); expect(m.bookedActs).toBe(1); expect(m.lineupPercent).toBe(50); });
  it("calculates fully configured lineup", () => { const m = build({ operations: { stages: [{}], slots: [slot("1"), slot("2")], staff: [{}], insurance_policies: [{}] }, finance: { approved_budget_cents: 10000 } }); expect(m.checks.find(c=>c.key==="lineup")?.status).toBe("complete"); });
  it("distinguishes missing ticket data", () => { const m = build({ operations: {} }); expect(m.capacity).toBeNull(); expect(m.ticketSalesPercent).toBeNull(); });
  it("allows zero tickets with valid capacity", () => { const m = build({ operations: { ticket_summary: { capacity: 100, tickets_sold: 0 } } }); expect(m.ticketsSold).toBe(0); expect(m.ticketSalesPercent).toBe(0); });
  it("marks missing finance query unavailable", () => { const m = build({ financeUnavailable: true }); expect(m.unavailableSections.some(s=>s.key==="finance")).toBe(true); });
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
