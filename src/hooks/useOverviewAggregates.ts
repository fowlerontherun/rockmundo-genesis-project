import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOverviewAggregates, type OverviewAggregateFilters } from "@/lib/api/overview";

export const useOverviewAggregates = (filters: OverviewAggregateFilters) => {
  const query = useQuery({
    queryKey: ["overview-aggregates", filters],
    queryFn: () => fetchOverviewAggregates(filters),
    staleTime: 5 * 60 * 1000,
  });

  const mapped = useMemo(() => {
    if (!query.data) {
      return {
        statCards: [],
        countries: [],
        submissions: [],
        submissionCountries: [],
      };
    }

    const topCountry = query.data.topWinningCountries[0];
    const topSubmissionSource = query.data.mostSubmissions[0];

    return {
      statCards: [
        {
          title: "Chart Wins",
          value: query.data.topWinningCountries.reduce((sum, item) => sum + item.wins, 0),
          description: filters.year && filters.year !== "all"
            ? `#1 placements during ${filters.year}`
            : "All-time #1 placements",
        },
        {
          title: "Top Winning Country",
          value: topCountry ? `${topCountry.country} (${topCountry.wins})` : "No winners yet",
          description: topCountry ? "Most #1 rankings" : "Waiting for chart data",
        },
        {
          title: "Submission Volume",
          value: query.data.submissionTotal,
          description: filters.year && filters.year !== "all"
            ? `Submissions during ${filters.year}`
            : "All-time submissions",
        },
        {
          title: "Top Submission Source",
          value: topSubmissionSource
            ? `${topSubmissionSource.label} (${topSubmissionSource.count})`
            : "No submissions yet",
          description: topSubmissionSource?.country
            ? `Most active in ${topSubmissionSource.country}`
            : "Most active source",
        },
      ],
      countries: query.data.topWinningCountries,
      submissions: query.data.mostSubmissions,
      submissionCountries: query.data.submissionsByCountry,
    };
  }, [query.data, filters.year]);

  return {
    ...query,
    mapped,
  };
};

export type UseOverviewAggregatesReturn = ReturnType<typeof useOverviewAggregates>;
