import type {
  TotpChartRundown,
  TotpChartRundownEntry,
  TotpRundownChartType,
} from "./chartRundownApi";

export interface TotpChartRundownPage {
  id: string;
  chartType: TotpRundownChartType;
  chartLabel: string;
  rangeLabel: string;
  minRank: number;
  maxRank: number;
  sourceCount: number;
  entries: TotpChartRundownEntry[];
}

const CHARTS: Array<{ type: TotpRundownChartType; label: string }> = [
  { type: "digital_sales", label: "Digital Sales Top 40" },
  { type: "streaming", label: "Streaming Top 40" },
];

const RANGES = [
  { minRank: 31, maxRank: 40 },
  { minRank: 21, maxRank: 30 },
  { minRank: 11, maxRank: 20 },
  { minRank: 1, maxRank: 10 },
] as const;

export function buildTotpChartRundownPages(rundown: TotpChartRundown): TotpChartRundownPage[] {
  const pages: TotpChartRundownPage[] = [];

  for (const chart of CHARTS) {
    const source = [...rundown[chart.type]]
      .filter((entry) => Number.isInteger(entry.rank) && entry.rank >= 1 && entry.rank <= 40)
      .sort((a, b) => b.rank - a.rank || a.song_title.localeCompare(b.song_title));

    for (const range of RANGES) {
      const entries = source.filter((entry) => entry.rank >= range.minRank && entry.rank <= range.maxRank);
      if (entries.length === 0) continue;

      pages.push({
        id: `${chart.type}:${range.maxRank}-${range.minRank}`,
        chartType: chart.type,
        chartLabel: chart.label,
        rangeLabel: `${range.maxRank}–${range.minRank}`,
        minRank: range.minRank,
        maxRank: range.maxRank,
        sourceCount: source.length,
        entries,
      });
    }
  }

  return pages;
}

export function totpRundownHasRealPositions(rundown?: TotpChartRundown | null): boolean {
  return !!rundown && buildTotpChartRundownPages(rundown).length > 0;
}
