import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const RandomEventsNews = () => {
  const { userId, profileId } = useActiveProfile();

  const { data: pendingEvents } = useQuery({
    queryKey: ["pending-random-events", userId, profileId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("player_events")
        .select(`
          id, status, created_at, profile_id,
          random_events(id, title, description, category)
        `)
        .eq("user_id", userId)
        .eq("status", "pending_choice")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return ((data as any[]) || []).filter(
        (r) => !r.profile_id || !profileId || r.profile_id === profileId,
      );
    },
    enabled: !!userId,
  });

  if (!pendingEvents || pendingEvents.length === 0) {
    return null;
  }

  const getCategoryColor = (category: string | undefined) => {
    switch (category) {
      case "financial": return "bg-green-500/20 text-green-500 border-green-500/30";
      case "health": return "bg-red-500/20 text-red-500 border-red-500/30";
      case "social": return "bg-purple-500/20 text-purple-500 border-purple-500/30";
      case "career": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "industry": return "bg-cyan-500/20 text-cyan-500 border-cyan-500/30";
      default: return "bg-muted";
    }
  };

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Events Awaiting Your Decision
          <Badge variant="destructive" className="ml-auto">
            {pendingEvents.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingEvents.map((pe: any) => (
          <div
            key={pe.id}
            className="p-3 rounded-lg bg-muted/50 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                <span className="font-medium truncate">
                  {pe.random_events?.title || "Unknown Event"}
                </span>
                <Badge className={`text-xs capitalize ${getCategoryColor(pe.random_events?.category)}`}>
                  {(pe.random_events?.category || "random").replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {pe.random_events?.description}
              </p>
            </div>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/home">Respond</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
