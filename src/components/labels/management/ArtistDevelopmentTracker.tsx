import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, Mic2, Music, Disc, Plane, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: 'scouting', label: 'Scouting', icon: Search },
  { key: 'demo_recording', label: 'Demo', icon: Mic2 },
  { key: 'rehearsal', label: 'Rehearsal', icon: Music },
  { key: 'release', label: 'Release', icon: Disc },
  { key: 'touring', label: 'Touring', icon: Plane },
] as const;

interface ArtistDevelopmentTrackerProps {
  labelId: string;
}

export function ArtistDevelopmentTracker({ labelId }: ArtistDevelopmentTrackerProps) {
  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['artist-dev-pipeline', labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artist_development_pipeline')
        .select('*')
        .eq('label_id', labelId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded" />)}</div>;
  }

  if (pipelines.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="font-semibold">No Development Pipelines</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sign artists and begin developing them through the pipeline stages.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {pipelines.map((pipeline) => {
        const completedStages = Array.isArray(pipeline.completed_stages) ? pipeline.completed_stages as string[] : [];
        const currentIdx = STAGES.findIndex(s => s.key === pipeline.current_stage);
        const progress = pipeline.completed_at ? 100 : ((currentIdx + 1) / STAGES.length) * 100;

        return (
          <Card key={pipeline.id} className="bg-card/60">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{pipeline.artist_name}</span>
                {pipeline.completed_at ? (
                  <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-400/30">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Developed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    <Clock className="h-3 w-3 mr-0.5" /> In Progress
                  </Badge>
                )}
              </div>

              <Progress value={progress} className="h-1.5" />

              <div className="flex items-center gap-1">
                {STAGES.map((stage, idx) => {
                  const isCompleted = completedStages.includes(stage.key);
                  const isCurrent = pipeline.current_stage === stage.key && !pipeline.completed_at;
                  const Icon = stage.icon;

                  return (
                    <div
                      key={stage.key}
                      className={cn(
                        "flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded",
                        isCompleted && "bg-emerald-500/10 text-emerald-400",
                        isCurrent && "bg-primary/10 text-primary font-medium",
                        !isCompleted && !isCurrent && "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{stage.label}</span>
                    </div>
                  );
                })}
              </div>

              {pipeline.notes && (
                <p className="text-xs text-muted-foreground italic">{pipeline.notes}</p>
              )}
              {pipeline.bonus_fame_awarded > 0 && (
                <span className="text-[10px] text-amber-400">+{pipeline.bonus_fame_awarded} bonus fame awarded</span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
