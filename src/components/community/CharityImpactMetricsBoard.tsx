import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CharityCampaignWithDetails } from "./useCharityCampaignData";
import { LineChart } from "lucide-react";

interface CharityImpactMetricsBoardProps {
  campaigns: CharityCampaignWithDetails[];
  isLoading: boolean;
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export function CharityImpactMetricsBoard({ campaigns, isLoading }: CharityImpactMetricsBoardProps) {
  const metrics = useMemo(() => {
    return campaigns.flatMap((campaign) =>
      campaign.metrics.map((metric) => ({
        ...metric,
        campaignTitle: campaign.title,
      })),
    );
  }, [campaigns]);

  const sortedMetrics = useMemo(
    () =>
      [...metrics].sort((a, b) => {
        const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bDate - aDate;
      }),
    [metrics],
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!sortedMetrics.length) {
    return (
      <EmptyState
        title="Impact metrics will appear here"
        description="Track how each campaign is translating donations into measurable outcomes."
        icon={LineChart}
        className="py-16"
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sortedMetrics.map((metric) => (
        <Card key={metric.id}>
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">{metric.campaignTitle}</CardTitle>
            <CardDescription className="text-lg font-semibold text-foreground">
              {metric.metric_label}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">
              {numberFormatter.format(Number(metric.metric_value ?? 0))}
              {metric.metric_unit ? <span className="ml-1 text-base font-medium text-muted-foreground">{metric.metric_unit}</span> : null}
            </div>
            {metric.description ? (
              <p className="text-sm text-muted-foreground">{metric.description}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Updated {metric.updated_at ? new Date(metric.updated_at).toLocaleDateString() : "recently"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
