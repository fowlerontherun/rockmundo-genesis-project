import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketRankingsProps {
  companyId: string;
  companyType: string;
}

export function MarketRankings({ companyId, companyType }: MarketRankingsProps) {
  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['company-market-rankings', companyType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_market_rankings')
        .select('*, companies(name)')
        .eq('company_type', companyType)
        .order('rank_position', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded" />;
  }

  if (rankings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Market rankings haven't been calculated yet.</p>
        </CardContent>
      </Card>
    );
  }

  const getRankIcon = (pos: number) => {
    if (pos === 1) return <Trophy className="h-4 w-4 text-amber-400" />;
    if (pos === 2) return <Medal className="h-4 w-4 text-gray-300" />;
    if (pos === 3) return <Award className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs text-muted-foreground w-4 text-center">#{pos}</span>;
  };

  return (
    <div className="space-y-1">
      {rankings.map((ranking: any) => {
        const isOwn = ranking.company_id === companyId;
        return (
          <Card key={ranking.id} className={cn("bg-card/60", isOwn && "ring-1 ring-primary/30")}>
            <CardContent className="p-2.5 flex items-center gap-3">
              {getRankIcon(ranking.rank_position)}
              <span className={cn("text-sm flex-1", isOwn && "font-semibold")}>
                {ranking.companies?.name || 'Unknown'}
              </span>
              <Badge variant="outline" className="text-[10px]">
                Score: {Number(ranking.score).toLocaleString()}
              </Badge>
              {isOwn && <Badge className="text-[10px] bg-primary/20 text-primary">You</Badge>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
