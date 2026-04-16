import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Star, Music, TrendingUp, UserCheck, UserX } from "lucide-react";

interface ScoutReportsPanelProps {
  labelId: string;
}

export function ScoutReportsPanel({ labelId }: ScoutReportsPanelProps) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['label-scout-reports', labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_scout_reports')
        .select('*')
        .eq('label_id', labelId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const getPotentialColor = (score: number) => {
    if (score >= 80) return "text-amber-400";
    if (score >= 60) return "text-emerald-400";
    if (score >= 40) return "text-blue-400";
    return "text-muted-foreground";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <Badge variant="secondary" className="text-[10px]">New</Badge>;
      case 'contacted': return <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-400/30">Contacted</Badge>;
      case 'signed': return <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-400/30">Signed</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-[10px] text-muted-foreground">Passed</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}</div>;
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="font-semibold">No Scout Reports Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Hire A&R staff to automatically discover unsigned talent in your city.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4" />
          A&R Scout Reports ({reports.length})
        </h3>
      </div>

      <div className="space-y-2">
        {reports.map((report) => (
          <Card key={report.id} className="bg-card/60">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{report.artist_name}</span>
                    {getStatusBadge(report.status)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className={`h-3 w-3 ${getPotentialColor(report.potential_score)}`} />
                      Potential: {report.potential_score}/100
                    </span>
                    <span className="flex items-center gap-1">
                      <Music className="h-3 w-3" />
                      Genre Match: {Math.round(Number(report.genre_match) * 100)}%
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Fame: {report.fame_level}
                    </span>
                  </div>
                  {report.recommendation && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{report.recommendation}"</p>
                  )}
                </div>
                {report.status === 'new' && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      <UserCheck className="h-3 w-3 mr-1" />
                      Contact
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground">
                      <UserX className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
