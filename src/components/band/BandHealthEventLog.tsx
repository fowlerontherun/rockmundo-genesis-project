import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Activity, Heart, Shield, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthEvent {
  id: string;
  band_id: string;
  event_type: string;
  delta: number;
  new_value: number;
  source: string;
  description: string | null;
  created_at: string;
}

const STAT_CONFIG: Record<string, { icon: typeof Heart; label: string; color: string }> = {
  morale: { icon: Heart, label: "Morale", color: "text-pink-500" },
  reputation: { icon: Shield, label: "Reputation", color: "text-primary" },
  sentiment: { icon: Smile, label: "Sentiment", color: "text-emerald-400" },
};

interface BandHealthEventLogProps {
  bandId: string;
}

export const BandHealthEventLog = ({ bandId }: BandHealthEventLogProps) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["band-health-events", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("band_health_events")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as HealthEvent[];
    },
    enabled: !!bandId,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-oswald flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
            Loading health log...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!events?.length) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-oswald flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            Health Event Log
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="text-[10px] text-muted-foreground italic">
            No health events recorded yet. Play gigs, manage your company, and engage with fans to see stat changes here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Health Event Log
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            {events.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-[200px]">
          <div className="space-y-1.5">
            {events.map((event) => {
              const config = STAT_CONFIG[event.event_type] || STAT_CONFIG.morale;
              const StatIcon = config.icon;
              const isPositive = event.delta > 0;
              const isNeutral = event.delta === 0;

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-1.5 rounded-sm hover:bg-muted/30 transition-colors"
                >
                  <div className={cn("p-1 rounded-full shrink-0 mt-0.5", 
                    isPositive ? "bg-emerald-500/20" : isNeutral ? "bg-muted" : "bg-destructive/20"
                  )}>
                    {isPositive ? (
                      <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
                    ) : isNeutral ? (
                      <Minus className="h-2.5 w-2.5 text-muted-foreground" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatIcon className={cn("h-2.5 w-2.5 shrink-0", config.color)} />
                      <span className="text-[10px] font-medium truncate">
                        {event.description || event.source.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[9px] font-mono",
                        isPositive ? "text-emerald-400" : isNeutral ? "text-muted-foreground" : "text-destructive"
                      )}>
                        {isPositive ? "+" : ""}{event.delta} {config.label.toLowerCase()}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        → {event.new_value}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
