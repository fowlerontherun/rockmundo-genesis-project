import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hookSource = readFileSync("src/hooks/useCityDevelopment.ts", "utf8");
const historySource = readFileSync("src/components/city/MayorHistoryTab.tsx", "utf8");
const typeSource = readFileSync("src/types/city-development.ts", "utf8");

describe("City Hall development audit history", () => {
  it("loads city development history with the completed project context", () => {
    expect(hookSource).toContain("useCityDevelopmentHistory");
    expect(hookSource).toContain('.from("city_development_history")');
    expect(hookSource).toContain('project:city_projects(name, description, cost, completed_at)');
    expect(hookSource).toContain('.order("created_at", { ascending: false })');
  });

  it("types before, after and delta snapshots", () => {
    expect(typeSource).toContain("CityDevelopmentHistoryEntry");
    expect(typeSource).toContain("deltas: Partial<Record<CityDevelopmentRatingKey, number>>");
    expect(typeSource).toContain("before_state: Partial<Record<CityDevelopmentRatingKey, number>>");
    expect(typeSource).toContain("after_state: Partial<Record<CityDevelopmentRatingKey, number>>");
  });

  it("shows exact permanent rating transitions in City Hall history", () => {
    expect(historySource).toContain("City development timeline");
    expect(historySource).toContain("Permanent city change");
    expect(historySource).toContain("CITY_DEVELOPMENT_LABELS");
    expect(historySource).toContain("change.before");
    expect(historySource).toContain("change.after");
    expect(historySource).toContain("change.delta");
  });
});
