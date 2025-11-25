import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CharityCampaignWithDetails } from "./useCharityCampaignData";
import { CalendarDays, Target, Heart } from "lucide-react";

interface CharityCampaignGridProps {
  campaigns: CharityCampaignWithDetails[];
  isLoading: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  if (!startDate && !endDate) {
    return "Timeline to be announced";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const startLabel = startDate ? formatter.format(new Date(startDate)) : "TBD";
  const endLabel = endDate ? formatter.format(new Date(endDate)) : "Open";

  return `${startLabel} – ${endLabel}`;
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  upcoming: "secondary",
  completed: "outline",
  archived: "destructive",
};

const statusLabel: Record<string, string> = {
  active: "Active",
  upcoming: "Upcoming",
  completed: "Completed",
  archived: "Archived",
};

export function CharityCampaignGrid({ campaigns, isLoading }: CharityCampaignGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="flex h-full flex-col">
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Skeleton className="h-2 w-full" />
              <div className="flex w-full items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <EmptyState
        title="No campaigns yet"
        description="Community charity campaigns will appear here once they are launched."
        icon={Heart}
        className="py-16"
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {campaigns.map((campaign) => {
        const goal = Number(campaign.goal_amount ?? 0);
        const raised = campaign.donations.reduce((sum, donation) => sum + Number(donation.amount ?? 0), 0);
        const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
        const status = (campaign.status ?? "active").toLowerCase();
        const badgeVariant = statusVariant[status] ?? "secondary";
        const badgeLabel = statusLabel[status] ?? campaign.status ?? "Active";

        return (
          <Card key={campaign.id} className="flex h-full flex-col">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-semibold leading-tight">{campaign.title}</CardTitle>
                <Badge variant={badgeVariant}>{badgeLabel}</Badge>
              </div>
              <CardDescription>{campaign.summary}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Benefiting <span className="font-medium text-foreground">{campaign.beneficiary}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  <span>{formatDateRange(campaign.start_date, campaign.end_date)}</span>
                </div>
                {campaign.impact_focus ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="h-4 w-4" aria-hidden="true" />
                    <span>Impact focus: {campaign.impact_focus}</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{currencyFormatter.format(raised)} raised</span>
                  <span className="text-muted-foreground">Goal: {currencyFormatter.format(goal)}</span>
                </div>
                <Progress value={progress} aria-label={`Campaign progress at ${progress}%`} />
                <p className="text-xs text-muted-foreground">
                  {campaign.donations.length} donation{campaign.donations.length === 1 ? "" : "s"} recorded
                </p>
              </div>
            </CardContent>

            <CardFooter className="mt-auto flex flex-col items-start gap-2 text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">Campaign ID: {campaign.slug}</span>
              <span>Last updated {campaign.updated_at ? new Date(campaign.updated_at).toLocaleDateString() : "Recently"}</span>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
