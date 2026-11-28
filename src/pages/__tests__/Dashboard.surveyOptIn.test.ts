import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync("src/pages/Dashboard.tsx", "utf8");

describe("dashboard survey invitation", () => {
  it("lets players opt into the existing rewarded survey instead of forcing it open at login", () => {
    expect(dashboardSource).toContain("const [surveyOpen, setSurveyOpen] = useState(false)");
    expect(dashboardSource).toContain("open={surveyOpen && shouldShowSurvey");
    expect(dashboardSource).toContain("setSurveyOpen(true)");
    expect(dashboardSource).toContain("Help shape RockMundo");
  });
});
