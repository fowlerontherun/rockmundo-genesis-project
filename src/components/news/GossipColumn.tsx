import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Heart, Shirt, AlertTriangle } from "lucide-react";

export function GossipColumn() {
  const today = new Date().toISOString().split("T")[0];

  const { data: gossipItems } = useQuery({
    queryKey: ["gossip-column", today],
    queryFn: async () => {
      const items: Array<{ icon: string; headline: string; detail: string; type: string }> = [];

      // Band drama events
      const { data: drama } = await supabase
        .from("band_drama_events")
        .select("drama_type, severity, description, bands(name)")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(5);

      drama?.forEach((d: any) => {
        const bandName = d.bands?.name || "A band";
        const dramaLabel = d.drama_type?.replace(/_/g, " ") || "drama";
        items.push({
          icon: "drama",
          headline: `${bandName} rocked by ${dramaLabel}!`,
          detail: d.description || `A ${d.severity || "minor"} incident has tongues wagging.`,
          type: "drama",
        });
      });

      // Reputation events as scandals
      const { data: repEvents } = await (supabase as any)
        .from("reputation_events")
        .select("event_type, reputation_change, description, bands(name)")
        .gte("created_at", `${today}T00:00:00`)
        .lt("reputation_change", 0)
        .order("reputation_change", { ascending: true })
        .limit(3);

      repEvents?.forEach((r: any) => {
        items.push({
          icon: "scandal",
          headline: `Scandal: ${r.bands?.name || "Unknown"} loses reputation`,
          detail: r.description || `A reputation hit of ${r.reputation_change} points.`,
          type: "scandal",
        });
      });

      return items.slice(0, 6);
    },
    staleTime: 5 * 60 * 1000,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "drama": return <MessageSquare className="h-4 w-4 text-warning shrink-0" />;
      case "romance": return <Heart className="h-4 w-4 text-pink-500 shrink-0" />;
      case "fashion": return <Shirt className="h-4 w-4 text-purple-500 shrink-0" />;
      case "scandal": return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
      default: return <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <Card className="border-warning/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-warning" />
          Gossip & Drama
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {gossipItems && gossipItems.length > 0 ? (
          gossipItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
              {getIcon(item.type)}
              <div className="min-w-0">
                <p className="text-sm font-semibold font-serif leading-tight">{item.headline}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.detail}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic font-serif py-2">
            No scandals to report today... for now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
