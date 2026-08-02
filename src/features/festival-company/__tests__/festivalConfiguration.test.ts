import { describe, expect, it } from "vitest";
import { configurationToDraft, draftsEqual, inclusiveDuration, parseFestivalConfiguration } from "../domain/festivalConfiguration";
import { maximumReachableStep, validateFestivalDraft } from "../domain/festivalConfigurationValidation";
const id = "123e4567-e89b-42d3-a456-426614174000";
const city = { id, name: "London", country: "United Kingdom", timezone: "Europe/London" };
const scale = { key: "small" as const, displayName: "Small", description: "Regional festival", minimumCapacity: 2_000, maximumCapacity: 7_500, maximumDurationDays: 3, complexity: "Moderate" };
const option = (key: string) => ({ key, displayName: key, description: `${key} choice` });
const canonical = { festivalCompanyId: id, legalCompanyName: "Company Ltd", publicName: "Festival", shortName: "Fest", tagline: "Hello", description: "Description", homeCity: city, festivalScale: "small" as const, annualMonth: 6, countryCode: "United Kingdom", vibe: "community" as const, siteType: "outdoor" as const, environmentalPolicy: "responsible" as const, festivalEditionId: id, editionYear: 5, plannedStartDate: "2030-06-01", plannedEndDate: "2030-06-03", durationDays: 3, setupStatus: "ready_for_planning" as const, currentStep: 6, configurationVersion: 2, updatedAt: "2030-01-01T12:00:00Z", canWrite: true, scales: [scale], cities: [city], vibes: [option("community")], siteTypes: [option("outdoor")], environmentalPolicies: [option("responsible")] };
describe("festival configuration boundary", () => {
  it("calculates inclusive UTC dates and rejects impossible input", () => { expect(inclusiveDuration("2030-06-01", "2030-06-03")).toBe(3); expect(inclusiveDuration("2030-06-03", "2030-06-01")).toBeNull(); expect(inclusiveDuration("2030-02-30", "2030-03-01")).toBeNull(); });
  it("strictly parses every canonical field", () => expect(parseFestivalConfiguration(canonical)).toEqual(canonical));
  it.each([
    ["nullable type", { homeCity: "London" }], ["status", { setupStatus: "complete" }], ["version", { configurationVersion: 0 }],
    ["step", { currentStep: 7 }], ["scale catalogue", { scales: [{ ...scale, maximumCapacity: 1 }] }],
    ["city catalogue", { cities: [{ ...city, timezone: "Mars/Olympus" }] }], ["duration", { durationDays: 2 }],
    ["one date", { plannedEndDate: null, durationDays: null }], ["timestamp", { updatedAt: "yesterday" }],
  ])("rejects malformed %s", (_name, replacement) => expect(() => parseFestivalConfiguration({ ...canonical, ...replacement })).toThrow("malformed_festival_configuration_result"));
  it("rejects selected catalogue values that are absent", () => expect(() => parseFestivalConfiguration({ ...canonical, scales: [] })).toThrow("malformed_festival_configuration_result"));
  it("rejects incomplete ready state", () => expect(() => parseFestivalConfiguration({ ...canonical, homeCity: null })).toThrow("malformed_festival_configuration_result"));
  it("converts canonical responses without retaining submitted values", () => { const draft = configurationToDraft({ ...canonical, publicName: " Server normalised " }); expect(draft.publicName).toBe(" Server normalised "); expect(draft.currentStep).toBe(6); expect(draft.complete).toBe(true); });
  it("derives dirty state from meaningful draft differences", () => { const draft = configurationToDraft(canonical); expect(draftsEqual(draft, { ...draft })).toBe(true); expect(draftsEqual(draft, { ...draft, tagline: "Changed" })).toBe(false); });
});
describe("festival wizard validation", () => {
  const draft = configurationToDraft(canonical);
  it("locks later steps until prerequisites are valid", () => { const result = validateFestivalDraft({ ...draft, publicName: "x" }, [city], [scale], "2029-01-01"); expect(result.fields.publicName.code).toBe("festival_public_name_length"); expect(maximumReachableStep(result)).toBe(1); });
  it("permits review when all sections are valid", () => expect(maximumReachableStep(validateFestivalDraft(draft, [city], [scale], "2029-01-01"))).toBe(6));
  it("reports inactive catalogue entries", () => { const result = validateFestivalDraft(draft, [], [], "2029-01-01"); expect(result.fields.homeCityId.code).toBe("festival_city_inactive"); expect(result.fields.festivalScale.code).toBe("festival_scale_inactive"); });
  it("reports past, backwards and overlong schedules", () => { expect(validateFestivalDraft(draft, [city], [scale], "2031-01-01").fields.plannedStartDate.code).toBe("festival_start_past"); expect(validateFestivalDraft({ ...draft, plannedEndDate: "2030-05-31" }, [city], [scale], "2029-01-01").fields.plannedEndDate.code).toBe("festival_end_before_start"); expect(validateFestivalDraft({ ...draft, plannedEndDate: "2030-06-04" }, [city], [scale], "2029-01-01").fields.plannedEndDate.code).toBe("festival_duration_too_long"); });
});
