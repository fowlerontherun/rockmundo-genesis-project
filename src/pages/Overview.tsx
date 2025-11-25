import { useState } from "react";
import { BarChart3, Globe2, ListChecks, Radio } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { useOverviewAggregates } from "@/hooks/useOverviewAggregates";

const YEAR_OPTIONS = ["all", 2025, 2024, 2023] as const;

const formatYearLabel = (value: (typeof YEAR_OPTIONS)[number]) =>
  value === "all" ? "All time" : value.toString();

const OverviewPage = () => {
  const [year, setYear] = useState<(typeof YEAR_OPTIONS)[number]>("all");
  const { mapped, isLoading, isError, error } = useOverviewAggregates({ year });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Chart performance and submission health at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Year</div>
          <Select
            value={year.toString()}
            onValueChange={value =>
              setYear(value === "all" ? "all" : (Number(value) as (typeof YEAR_OPTIONS)[number]))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map(option => (
                <SelectItem key={option.toString()} value={option.toString()}>
                  {formatYearLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Overview unavailable</CardTitle>
            <CardDescription>{error?.message ?? "Something went wrong while loading analytics."}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)
          : mapped.statCards.map(card => (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
                description={card.description}
                icon={card.title.includes("Country") ? <Globe2 className="h-4 w-4" /> : undefined}
              />
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top winning countries
            </CardTitle>
            <CardDescription>
              {year === "all"
                ? "Countries with the most #1 chart placements"
                : `#1 placements during ${formatYearLabel(year)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : mapped.countries.length ? (
              <div className="space-y-3">
                {mapped.countries.map((country, index) => (
                  <div
                    key={country.country}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{country.country}</p>
                        <p className="text-xs text-muted-foreground">#1 placements</p>
                      </div>
                    </div>
                    <div className="text-lg font-semibold">{country.wins}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                No chart winners for this range.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Most submissions
            </CardTitle>
            <CardDescription>
              {year === "all"
                ? "Stations receiving the most submissions"
                : `Submissions during ${formatYearLabel(year)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : mapped.submissions.length ? (
              <div className="space-y-3">
                {mapped.submissions.map((submission, index) => (
                  <div
                    key={submission.label}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{submission.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {submission.country ?? "Unknown country"}
                        </p>
                      </div>
                    </div>
                    <div className="text-lg font-semibold">{submission.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                No submissions recorded for this range.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Submissions by country
          </CardTitle>
          <CardDescription>Where submissions are coming from most frequently.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : mapped.submissionCountries.length ? (
            <div className="space-y-2">
              {mapped.submissionCountries.map(country => (
                <div
                  key={country.label}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <p className="font-medium">{country.label}</p>
                  </div>
                  <div className="text-sm font-semibold">{country.count} submissions</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              No submission activity captured yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Data responds to the selected year and will expand automatically as more chart and submission events arrive.
      </p>
    </div>
  );
};

export default OverviewPage;
