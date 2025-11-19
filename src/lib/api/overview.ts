import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { supabase } from "@/integrations/supabase/client";

export type OverviewAggregateFilters = {
  year?: number | "all";
};

export interface TopCountryStat {
  country: string;
  wins: number;
}

export interface SubmissionStat {
  label: string;
  count: number;
  country?: string;
}

export interface OverviewAggregateResponse {
  topWinningCountries: TopCountryStat[];
  mostSubmissions: SubmissionStat[];
  submissionTotal: number;
  submissionsByCountry: SubmissionStat[];
  yearRange?: { start: string; end: string };
}

const buildYearRange = (year?: number | "all") => {
  if (!year || year === "all") return undefined;
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
};

const applyDateRange = <T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  column: string,
  range?: { start: string; end: string },
) => {
  if (!range) return query;
  return query.gte(column, range.start).lte(column, range.end);
};

export const fetchOverviewAggregates = async (
  filters: OverviewAggregateFilters = {},
): Promise<OverviewAggregateResponse> => {
  const yearRange = buildYearRange(filters.year);

  const chartQuery = supabase.from("chart_entries").select("country, rank, chart_date");
  const submissionQuery = supabase
    .from("radio_submissions")
    .select("id, submitted_at, station:radio_stations(name, country)");

  const [{ data: chartEntries, error: chartError }, { data: submissions, error: submissionError }] =
    await Promise.all([
      applyDateRange(chartQuery, "chart_date", yearRange),
      applyDateRange(submissionQuery, "submitted_at", yearRange),
    ]);

  if (chartError) {
    throw new Error(`Failed to load chart aggregates: ${chartError.message}`);
  }

  if (submissionError) {
    throw new Error(`Failed to load submission aggregates: ${submissionError.message}`);
  }

  const winCounts = new Map<string, number>();
  (chartEntries ?? []).forEach(entry => {
    if (entry.rank === 1 && entry.country) {
      winCounts.set(entry.country, (winCounts.get(entry.country) ?? 0) + 1);
    }
  });

  const topWinningCountries = Array.from(winCounts.entries())
    .map(([country, wins]) => ({ country, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);

  const submissionCounts = new Map<string, { count: number; country?: string }>();
  const submissionCountryCounts = new Map<string, number>();

  (submissions ?? []).forEach(submission => {
    const label = submission.station?.name ?? "Unknown Station";
    const country = submission.station?.country ?? undefined;
    submissionCounts.set(label, {
      count: (submissionCounts.get(label)?.count ?? 0) + 1,
      country,
    });

    if (country) {
      submissionCountryCounts.set(country, (submissionCountryCounts.get(country) ?? 0) + 1);
    }
  });

  const mostSubmissions = Array.from(submissionCounts.entries())
    .map(([label, { count, country }]) => ({ label, count, country }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const submissionsByCountry = Array.from(submissionCountryCounts.entries())
    .map(([country, count]) => ({ label: country, country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    topWinningCountries,
    mostSubmissions,
    submissionTotal: submissions?.length ?? 0,
    submissionsByCountry,
    yearRange,
  };
};
