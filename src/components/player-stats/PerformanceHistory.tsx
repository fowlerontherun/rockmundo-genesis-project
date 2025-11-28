import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music2, TrendingUp, Star } from "lucide-react";
import { format } from "date-fns";

interface PerformanceHistoryProps {
  userId?: string;
}

export function PerformanceHistory({ userId }: PerformanceHistoryProps) {
  const { data: gigOutcomes, isLoading } = useQuery({
    queryKey: ["gig-outcomes-history", userId],
    queryFn: async () => {
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);

      if (!bandMembers || bandMembers.length === 0) return [];

      const bandIds = bandMembers.map(bm => bm.band_id);

      const { data, error } = await supabase
        .from("gig_outcomes")
        .select(`
          *,
          gig:gigs!inner(
            id,
            scheduled_date,
            band_id,
            venue_id
          )
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading performance history...</p>
        </CardContent>
      </Card>
    );
  }

  if (!gigOutcomes || gigOutcomes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-12">
          <Music2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Performances Yet</h3>
          <p className="text-muted-foreground">Complete gigs to track your performance history</p>
        </CardContent>
      </Card>
    );
  }

  const gradeColors = {
    S: "text-yellow-500",
    A: "text-green-500",
    B: "text-blue-500",
    C: "text-orange-500",
    D: "text-red-500",
    pending: "text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Performances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gigOutcomes.map((outcome) => (
          <div key={outcome.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Performance</h3>
                <Badge 
                  variant="outline" 
                  className={gradeColors[outcome.performance_grade as keyof typeof gradeColors] || gradeColors.pending}
                >
                  Grade: {outcome.performance_grade || "Pending"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {outcome.venue_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {outcome.gig?.scheduled_date && format(new Date(outcome.gig.scheduled_date), "PPP")}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 mb-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold">{outcome.overall_rating?.toFixed(1) || "N/A"}</span>
              </div>
              <p className="text-sm text-green-500 font-semibold">
                ${outcome.net_profit?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {outcome.actual_attendance} attendees
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
