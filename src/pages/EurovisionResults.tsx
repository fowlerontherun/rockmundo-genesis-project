import { useEffect, useMemo, useState } from "react";
import {
  useEurovisionYearResults,
  useEurovisionYears,
} from "@/features/eurovision/hooks/useEurovisionData";
import { EurovisionResultsList } from "@/features/eurovision/components/EurovisionResultsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, Search } from "lucide-react";

const EurovisionResultsPage = () => {
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [countryFilter, setCountryFilter] = useState("");

  const {
    data: years,
    isLoading: yearsLoading,
    error: yearsError,
  } = useEurovisionYears();

  const {
    data: yearResults,
    isLoading: resultsLoading,
    error: resultsError,
    refetch,
  } = useEurovisionYearResults(selectedYear);

  useEffect(() => {
    if (!selectedYear && years && years.length > 0) {
      setSelectedYear(years[0].year);
    }
  }, [years, selectedYear]);

  const filteredEntries = useMemo(() => {
    if (!yearResults?.entries) return [];

    const term = countryFilter.trim().toLowerCase();
    if (!term) return yearResults.entries;

    return yearResults.entries.filter((entry) =>
      `${entry.country} ${entry.artist} ${entry.songTitle}`.toLowerCase().includes(term),
    );
  }, [yearResults, countryFilter]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Eurovision Results</h1>
        <p className="text-muted-foreground">
          Browse yearly Eurovision entries, voting breakdowns, and highlight the winner.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Year</label>
              {yearsError ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not load years</AlertTitle>
                  <AlertDescription>{yearsError.message}</AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={selectedYear ? String(selectedYear) : undefined}
                  onValueChange={(value) => setSelectedYear(Number(value))}
                  disabled={yearsLoading || !years || years.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={yearsLoading ? "Loading years..." : "Select year"} />
                  </SelectTrigger>
                  <SelectContent>
                    {yearsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {years?.map((year) => (
                      <SelectItem key={year.id} value={String(year.year)}>
                        {year.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Country or artist</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={countryFilter}
                  onChange={(event) => setCountryFilter(event.target.value)}
                  placeholder="Filter by country, artist, or song"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {yearResults?.winner && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/60 p-3">
              <Badge className="flex items-center gap-1" variant="default">
                <Crown className="h-3 w-3" />
                Winner
              </Badge>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{yearResults.winner.songTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {yearResults.winner.country} · {yearResults.winner.artist}
                </p>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                {yearResults.winner.totalPoints} pts total
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EurovisionResultsList
        year={selectedYear}
        entries={filteredEntries}
        winner={yearResults?.winner}
        isLoading={resultsLoading}
        error={resultsError?.message}
        onRetry={refetch}
      />
    </div>
  );
};

export default EurovisionResultsPage;
