import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Hammer, CheckCircle2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useCityProjects } from "@/hooks/useCityProjects";

export function CityProjectsPublicView({ cityId }: { cityId: string }) {
  const { data: projects } = useCityProjects(cityId);
  const active = projects?.filter(p => p.status === 'in_progress') ?? [];
  const completed = projects?.filter(p => p.status === 'completed').slice(0, 3) ?? [];

  if (active.length === 0 && completed.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Hammer className="h-4 w-4" /> City Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">In Progress</div>
            {active.map(p => {
              const start = new Date(p.started_at).getTime();
              const end = new Date(p.completes_at).getTime();
              const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(p.completes_at), { addSuffix: true })}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
        {completed.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Recently Completed</div>
            {completed.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" /> {p.name}
                </span>
                <Badge variant="outline" className="text-xs">+{p.approval_change}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
