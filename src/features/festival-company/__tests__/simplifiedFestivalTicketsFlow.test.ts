import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/features/festival-company/ui/FestivalTicketPlanner.tsx",
  ),
  "utf8",
);

describe("simplified Festival Tickets & budget flow", () => {
  it("keeps only the two player ticket decisions prominent", () => {
    expect(source).toContain("Standard ticket price");
    expect(source).toContain("Tickets available");
    expect(source).not.toContain("Forecast sell-through");
    expect(source).not.toContain("Expected gross sales");
    expect(source).not.toContain("Expected net ticket income");
  });

  it("uses the whole-Festival forecast and hands off to Run Festival", () => {
    expect(source).toContain("<FestivalBudgetForecast");
    expect(source).toContain("Expected attendance and ticket demand");
    expect(source).toContain("Projected Festival profit or loss");
    expect(source).toContain("Continue to Run Festival");
    expect(source).toContain(
      "festivalRoutes.live(festivalCompanyId, festivalEditionId)",
    );
  });
});
