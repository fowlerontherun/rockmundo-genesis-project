import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, AlertTriangle, TrendingUp, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CompanyEventsTimelineProps {
  companyId: string;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: typeof Award; color: string }> = {
  award: { icon: Award, color: "text-amber-400" },
  scandal: { icon: AlertTriangle, color: "text-destructive" },
  milestone: { icon: TrendingUp, color: "text-emerald-400" },
  acquisition_offer: { icon: Sparkles, color: "text-purple-400" },
  ipo: { icon: TrendingUp, color: "text-blue-400" },
};

export function CompanyEventsTimeline({ companyId }: CompanyEventsTimelineProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['company-events', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_events')
        .select('*')
        .eq('company_id', companyId)
        .order('occurred_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded" />)}</div>;
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No events yet. Build your company to unlock milestones.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const config = EVENT_TYPE_CONFIG[event.event_type] || { icon: Sparkles, color: "text-muted-foreground" };
        const Icon = config.icon;
        return (
          <Card key={event.id} className="bg-card/60">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{event.title}</span>
                    {event.is_resolved ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    ) : event.event_type === 'scandal' ? (
                      <Badge variant="destructive" className="text-[10px]">Unresolved</Badge>
                    ) : null}
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}</span>
                    {event.impact_value !== 0 && (
                      <span className={Number(event.impact_value) > 0 ? "text-emerald-400" : "text-destructive"}>
                        {Number(event.impact_value) > 0 ? '+' : ''}{Number(event.impact_value)} {event.impact_area || 'reputation'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
