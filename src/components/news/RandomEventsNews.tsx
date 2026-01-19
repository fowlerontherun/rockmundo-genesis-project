import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const RandomEventsNews = () => {
  const { user } = useAuth();

  const { data: pendingEvents } = useQuery({
    queryKey: ["pending-random-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_events")
        .select(`
          id, status, created_at,
          random_events(id, title, description, rarity, category)
        `)
        .eq("user_id", user.id)
        .eq("status", "pending_choice")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  if (!pendingEvents || pendingEvents.length === 0) {
    return null;
  }

  const getRarityColor = (rarity: string | undefined) => {
    switch (rarity) {
      case "legendary": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "epic": return "bg-purple-500/20 text-purple-500 border-purple-500/30";
      case "rare": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
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
                <Badge className={`text-xs ${getRarityColor(pe.random_events?.rarity)}`}>
                  {pe.random_events?.rarity || "common"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {pe.random_events?.description}
              </p>
            </div>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/random-events">Respond</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};