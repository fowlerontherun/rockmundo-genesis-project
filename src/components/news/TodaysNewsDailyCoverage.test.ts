import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("Today's News truthful daily coverage", () => {
  const page = readFileSync("src/pages/TodaysNews.tsx", "utf8");
  const ticker = readFileSync("src/components/news/BreakingNewsTicker.tsx", "utf8");

  it("bounds new bands to the current edition", () => {
    expect(page).toContain('.gte("created_at", dayStart)');
    expect(page).toContain('.lt("created_at", `${tomorrow}T00:00:00`)');
  });
  it("bounds published releases to the current edition", () => {
    expect(page).toContain('.gte("release_date", dayStart)');
    expect(page).toContain('.lt("release_date", `${tomorrow}T00:00:00`)');
  });
  it("does not advertise old or future festivals as starting today", () => {
    expect(page).toContain('.gte("start_date", dayStart)');
    expect(page).toContain('.lt("start_date", `${tomorrow}T00:00:00`)');
  });
  it("does not fabricate ticker news and removes duplicates", () => {
    expect(ticker).not.toContain("Stay tuned for today's breaking stories");
    expect(ticker).toContain("new Set(items)");
  });
});
