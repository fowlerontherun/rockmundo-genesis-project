import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TwaatCard } from "./TwaatCard";
import { Loader2, TrendingUp } from "lucide-react";

interface TrendingTwaatsProps {
  viewerAccountId: string;
}

export function TrendingTwaats({ viewerAccountId }: TrendingTwaatsProps) {
  const { data: trendingTwaats, isLoading } = useQuery({
    queryKey: ["trending-twaats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts(*),
          metrics:twaat_metrics(*),
          replies:twaater_replies(count)
        `)
        .eq("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Calculate engagement score and sort
      const scored = data.map(twaat => ({
        ...twaat,
        score: (twaat.metrics?.[0]?.likes || 0) * 2 + 
               (twaat.metrics?.[0]?.retwaats || 0) * 3 +
               (twaat.metrics?.[0]?.replies || 0)
      }));

      return scored.sort((a, b) => b.score - a.score).slice(0, 20);
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!trendingTwaats || trendingTwaats.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Trending Posts Yet</h3>
          <p className="text-sm text-muted-foreground">
            Popular twaats will appear here based on engagement
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {trendingTwaats.map((twaat) => (
        <TwaatCard
          key={twaat.id}
          twaat={twaat}
          viewerAccountId={viewerAccountId}
        />
      ))}
    </div>
  );
}
