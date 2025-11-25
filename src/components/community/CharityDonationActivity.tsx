import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CharityCampaignWithDetails } from "./useCharityCampaignData";
import { Gift, Clock } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

interface CharityDonationActivityProps {
  campaigns: CharityCampaignWithDetails[];
  isLoading: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function CharityDonationActivity({ campaigns, isLoading }: CharityDonationActivityProps) {
  const donations = useMemo(() => {
    return campaigns
      .flatMap((campaign) => {
        const totalRaised = campaign.donations.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
        return campaign.donations.map((donation) => ({
          ...donation,
          campaignTitle: campaign.title,
          goalAmount: Number(campaign.goal_amount ?? 0),
          totalRaised,
        }));
      })
      .sort((a, b) => {
        const aTime = a.donated_at ? new Date(a.donated_at).getTime() : 0;
        const bTime = b.donated_at ? new Date(b.donated_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [campaigns]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent donations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!donations.length) {
    return (
      <EmptyState
        title="Donation activity will appear here"
        description="Track supporter momentum in real time as campaigns receive contributions."
        icon={Gift}
        className="py-16"
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent donations</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[360px] pr-4">
          <ul className="space-y-4">
            {donations.map((donation) => {
              const donor = donation.donor_name?.trim() ? donation.donor_name : "Anonymous supporter";
              const donatedAt = donation.donated_at ? new Date(donation.donated_at) : null;
              const relativeTime = donatedAt ? formatDistanceToNowStrict(donatedAt, { addSuffix: true }) : "Recently";
              const progress = donation.goalAmount > 0
                ? Math.min(100, Math.round((donation.totalRaised / donation.goalAmount) * 100))
                : null;

              return (
                <li key={donation.id} className="rounded-lg border border-border/60 bg-background/40 p-4 shadow-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium leading-tight">{donor}</p>
                        <p className="text-sm text-muted-foreground">{currencyFormatter.format(Number(donation.amount ?? 0))}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{relativeTime}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Contributed to <span className="font-medium text-foreground">{donation.campaignTitle}</span>
                      {progress !== null ? ` — campaign now at ${progress}% of its goal` : ""}
                    </p>
                    {donation.message ? (
                      <p className="rounded-md bg-muted/40 p-2 text-sm italic text-muted-foreground">
                        “{donation.message}”
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
