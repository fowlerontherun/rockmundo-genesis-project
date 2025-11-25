import { useQuery } from "@tanstack/react-query";
import {
  fetchEurovisionYearResults,
  fetchEurovisionYears,
  type EurovisionYear,
  type EurovisionYearResults,
} from "@/lib/eurovision";

export const useEurovisionYears = () =>
  useQuery<EurovisionYear[]>({
    queryKey: ["eurovision", "years"],
    queryFn: fetchEurovisionYears,
  });

export const useEurovisionYearResults = (year?: number) =>
  useQuery<EurovisionYearResults>({
    queryKey: ["eurovision", "results", year],
    queryFn: () => fetchEurovisionYearResults(year!),
    enabled: Boolean(year),
    staleTime: 1000 * 60 * 5,
  });
