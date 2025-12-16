import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Zap } from "lucide-react";
import { format } from "date-fns";

export function MilestoneNews() {
  const today = new Date().toISOString().split('T')[0];

  const { data: milestones } = useQuery({
    queryKey: ["milestone-news", today],
    queryFn: async () => {
      const results: Array<{ type: string; title: string; detail: string; time: string }> = [];

      // Recent achievements unlocked
      const { data: achievements } = await supabase
        .from("player_achievements")
        .select("unlocked_at, achievements(name, description), profiles(username)")
        .gte("unlocked_at", `${today}T00:00:00`)
        .order("unlocked_at", { ascending: false })
        .limit(5);

      achievements?.forEach((ach: any) => {
        if (ach.achievements && ach.profiles) {
          results.push({
            type: "achievement",
            title: `${ach.profiles.username} unlocked "${ach.achievements.name}"`,
            detail: ach.achievements.description || "",
            time: format(new Date(ach.unlocked_at), "HH:mm"),
          });
        }
      });

      // Fame milestones (bands reaching 1000, 5000, 10000 fame)
      const { data: fameBands } = await supabase
        .from("band_fame_events")
        .select("fame_gained, event_type, created_at, bands(name, fame)")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(5);

      fameBands?.forEach((event: any) => {
        if (event.bands) {
          results.push({
            type: "fame",
            title: `${event.bands.name} gained fame`,
            detail: `+${event.fame_gained} fame (${event.event_type})`,
            time: format(new Date(event.created_at), "HH:mm"),
          });
        }
      });

      return results.slice(0, 6);
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "achievement": return <Trophy className="h-4 w-4 text-yellow-500" />;
      case "fame": return <Star className="h-4 w-4 text-purple-500" />;
      default: return <Zap className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" />
          Milestones & Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {milestones && milestones.length > 0 ? (
          milestones.map((milestone, index) => (
            <div key={index} className="flex items-start gap-2 py-1">
              {getIcon(milestone.type)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{milestone.title}</p>
                <p className="text-xs text-muted-foreground truncate">{milestone.detail}</p>
              </div>
              <Badge variant="outline" className="shrink-0">{milestone.time}</Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">No milestones today</p>
        )}
      </CardContent>
    </Card>
  );
}
