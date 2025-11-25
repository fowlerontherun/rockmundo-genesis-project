import { CharityCampaignGrid } from "@/components/community/CharityCampaignGrid";
import { CharityDonationActivity } from "@/components/community/CharityDonationActivity";
import { CharityImpactMetricsBoard } from "@/components/community/CharityImpactMetricsBoard";
import { CharityImpactSummary } from "@/components/community/CharityImpactSummary";
import { useCharityCampaignData } from "@/components/community/useCharityCampaignData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
import { useMemo } from "react";

export default function CharityPage() {
  const { data, isLoading, error, refetch, isFetching } = useCharityCampaignData();

  const campaigns = useMemo(() => data ?? [], [data]);

  return (
    <div className="container mx-auto flex flex-col gap-10 px-4 py-10">
      <div className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">Community Uplift</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Charity Campaigns & Impact</h1>
        <p className="mx-auto max-w-3xl text-muted-foreground">
          Follow how the RockMundo community pools resources to support urgent causes, track real-time donations, and
          celebrate the measurable impact artists and fans are making together.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="mx-auto w-full max-w-3xl">
          <AlertTitle>We couldn&apos;t load community campaign data</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error.message ?? "An unexpected error occurred while contacting Supabase."}</span>
            <Button onClick={() => refetch()} variant="outline" className="self-start" disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-10">
          <CharityImpactSummary campaigns={campaigns} isLoading={isLoading} />
          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Campaign portfolio</h2>
              <p className="text-muted-foreground">
                Explore each initiative, its focus, and how close it is to reaching its funding goal.
              </p>
            </div>
            <CharityCampaignGrid campaigns={campaigns} isLoading={isLoading} />
          </section>

          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Impact metrics</h2>
              <p className="text-muted-foreground">
                Quantify how donations are being transformed into meaningful outcomes across campaigns.
              </p>
            </div>
            <CharityImpactMetricsBoard campaigns={campaigns} isLoading={isLoading} />
          </section>

          <section className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Donation momentum</h2>
              <p className="text-muted-foreground">Review the latest contributions fueling each cause.</p>
            </div>
            <CharityDonationActivity campaigns={campaigns} isLoading={isLoading} />
          </section>
        </div>
      )}
    </div>
  );
}
