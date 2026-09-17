import { describe, expect, it } from "vitest";
import type { TotpChartRundown, TotpChartRundownEntry } from "./chartRundownApi";
import { buildTotpChartRundownPages, totpRundownHasRealPositions } from "./chartRundown";

function entry(rank: number, songTitle = `Song ${rank}`): TotpChartRundownEntry {
  return {
    rank,
    song_id: `00000000-0000-4000-8000-${String(rank).padStart(12, "0")}`,
    band_id: null,
    song_title: songTitle,
    artist_name: `Artist ${rank}`,
    trend: rank % 2 === 0 ? "up" : "stable",
    trend_change: rank % 2 === 0 ? 1 : 0,
    weekly_plays: rank * 100,
  };
}

function rundown(overrides: Partial<TotpChartRundown> = {}): TotpChartRundown {
  return {
    episode_id: "00000000-0000-4000-8000-000000000001",
    chart_snapshot_date: "2026-09-07",
    streaming: [],
    digital_sales: [],
    streaming_count: 0,
    digital_sales_count: 0,
    ...overrides,
  };
}

describe("Top of the Pops frozen chart rundown", () => {
  it("builds separate Digital Sales and Streaming pages in 40-to-1 blocks", () => {
    const pages = buildTotpChartRundownPages(rundown({
      digital_sales: [entry(3), entry(31), entry(12)],
      streaming: [entry(1), entry(40), entry(25), entry(11)],
    }));

    expect(pages.map((page) => [page.chartType, page.rangeLabel])).toEqual([
      ["digital_sales", "40–31"],
      ["digital_sales", "20–11"],
      ["digital_sales", "10–1"],
      ["streaming", "40–31"],
      ["streaming", "30–21"],
      ["streaming", "20–11"],
      ["streaming", "10–1"],
    ]);
  });

  it("orders entries downward through the countdown inside each page", () => {
    const pages = buildTotpChartRundownPages(rundown({
      streaming: [entry(1), entry(9), entry(4), entry(10)],
    }));

    expect(pages).toHaveLength(1);
    expect(pages[0].entries.map((item) => item.rank)).toEqual([10, 9, 4, 1]);
  });

  it("skips empty rank blocks instead of showing blank countdown screens", () => {
    const pages = buildTotpChartRundownPages(rundown({ streaming: [entry(2), entry(1)] }));
    expect(pages.map((page) => page.rangeLabel)).toEqual(["10–1"]);
  });

  it("reports the real source count on every page", () => {
    const pages = buildTotpChartRundownPages(rundown({
      digital_sales: [entry(1), entry(12), entry(32)],
    }));
    expect(pages.map((page) => page.sourceCount)).toEqual([3, 3, 3]);
  });

  it("never fabricates missing positions or accepts ranks outside the Top 40", () => {
    const realEntries = [entry(1), entry(7), entry(24), entry(40), entry(41), entry(0)];
    const pages = buildTotpChartRundownPages(rundown({ streaming: realEntries }));
    const renderedRanks = pages.flatMap((page) => page.entries.map((item) => item.rank));

    expect(renderedRanks).toEqual([40, 24, 7, 1]);
    expect(renderedRanks).not.toContain(2);
    expect(renderedRanks).not.toContain(41);
    expect(renderedRanks).not.toContain(0);
  });

  it("only reports a runnable chart sequence when at least one real position exists", () => {
    expect(totpRundownHasRealPositions(rundown())).toBe(false);
    expect(totpRundownHasRealPositions(rundown({ digital_sales: [entry(2)] }))).toBe(true);
  });
});
