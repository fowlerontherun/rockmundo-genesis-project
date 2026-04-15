import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic2 } from "lucide-react";

export function InterviewNews() {
  const today = new Date().toISOString().split("T")[0];

  const { data: interviews } = useQuery({
    queryKey: ["interview-news", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("interview_results")
        .select("id, performance_score, fame_gained, created_at, bands(name)")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) return [];
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!interviews || interviews.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Mic2 className="h-5 w-5" />
          Today's Interviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {interviews.map((iv: any, i: number) => (
          <div key={iv.id || i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
            <div>
              <p className="text-sm font-serif font-semibold">
                {iv.bands?.name || "Unknown"} sat down for an interview
              </p>
              <p className="text-xs text-muted-foreground">
                Performance: {iv.performance_score}/100 · Fame +{iv.fame_gained}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {iv.performance_score >= 80 ? "⭐ Great" : iv.performance_score >= 50 ? "👍 OK" : "😬 Rough"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
