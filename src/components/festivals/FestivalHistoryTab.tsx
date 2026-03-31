import { Card, CardContent } from "@/components/ui/card";
import { Loader2, History } from "lucide-react";
import { useFestivalHistory } from "@/hooks/useFestivalHistory";
import { FestivalHistoryCard } from "./history/FestivalHistoryCard";
import { FestivalHistoryStats } from "./history/FestivalHistoryStats";
import { useUserBand } from "@/hooks/useUserBand";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export function FestivalHistoryTab() {
  const { profileId, userId } = useActiveProfile();
  const { data: band } = useUserBand();
  const { performances, stats, isLoading } = useFestivalHistory(band?.id, userId || undefined);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (performances.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Festival History</h3>
          <p className="text-sm text-muted-foreground">
            Perform at festivals to build your history and track your career growth.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <FestivalHistoryStats stats={stats} />
      <div className="space-y-4">
        {performances.map((performance) => (
          <FestivalHistoryCard key={performance.id} performance={performance} />
        ))}
      </div>
    </div>
  );
}
