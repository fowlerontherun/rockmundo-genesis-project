import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CharityCampaignWithDetails } from "./useCharityCampaignData";
import { Users, Target, HeartHandshake, BarChart3 } from "lucide-react";

interface CharityImpactSummaryProps {
  campaigns: CharityCampaignWithDetails[];
  isLoading: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function CharityImpactSummary({ campaigns, isLoading }: CharityImpactSummaryProps) {
  const { totalRaised, totalGoal, activeCampaigns, uniqueDonors, averageProgress } = useMemo(() => {
    const totals = campaigns.reduce(
      (acc, campaign) => {
        const goal = Number(campaign.goal_amount ?? 0);
        const raised = campaign.donations.reduce((sum, donation) => sum + Number(donation.amount ?? 0), 0);

        acc.totalGoal += goal;
        acc.totalRaised += raised;
        acc.totalDonations += campaign.donations.length;

        campaign.donations.forEach((donation) => {
          const donorKey = donation.donor_name?.trim().toLowerCase() || `anon-${donation.id}`;
          acc.donors.add(donorKey);
        });

        if ((campaign.status ?? "").toLowerCase() === "active") {
          acc.active += 1;
        }

        return acc;
      },
      {
        totalGoal: 0,
        totalRaised: 0,
        totalDonations: 0,
        donors: new Set<string>(),
        active: 0,
      },
    );

    const averageProgress = totals.totalGoal > 0 ? totals.totalRaised / totals.totalGoal : 0;

    return {
      totalGoal: totals.totalGoal,
      totalRaised: totals.totalRaised,
      activeCampaigns: totals.active,
      uniqueDonors: totals.donors.size,
      averageProgress,
    };
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Raised for Impact</CardTitle>
          <HeartHandshake className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{currencyFormatter.format(totalRaised)}</div>
          <p className="text-xs text-muted-foreground">Across all community campaigns</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Progress Toward Goals</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">
            {totalGoal > 0 ? percentFormatter.format(averageProgress) : "N/A"}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalGoal > 0
              ? `${currencyFormatter.format(totalRaised)} of ${currencyFormatter.format(totalGoal)} raised`
              : "Goal targets coming soon"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{activeCampaigns}</div>
          <p className="text-xs text-muted-foreground">Tracking live community initiatives</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Community Donors</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{uniqueDonors}</div>
          <p className="text-xs text-muted-foreground">Unique supporters powering these causes</p>
        </CardContent>
      </Card>
    </div>
  );
}
