import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Today's News expandable section layout", () => {
  const page = readFileSync("src/pages/TodaysNews.tsx", "utf8");
  const list = readFileSync("src/components/news/NewsList.tsx", "utf8");

  it("provides collapsible topic groups", () => {
    for (const topic of ["Music, Charts & Releases", "Festivals & Live Events", "Bands & Business", "Community & Social"]) {
      expect(page).toContain(topic);
    }
    expect(page).toContain("<NewsCategory");
  });

  it("paginates individual news lists to ten rows", () => {
    expect(list).toContain("const PAGE_SIZE = 10");
    expect(list).toContain("items.slice(start, start + PAGE_SIZE)");
    expect(list).toContain("Previous");
    expect(list).toContain("Next");
  });

  it("keeps date-bound daily stories", () => {
    expect(page).toContain('.lt("created_at", `${nextDay}T00:00:00`)');
    expect(page).toContain('.lt("release_date", `${nextDay}T00:00:00`)');
  });
});
