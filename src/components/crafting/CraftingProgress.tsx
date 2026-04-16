import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Package, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { CraftingSession } from "@/hooks/useCraftingSystem";
import { getQualityLabel } from "@/data/craftingMaterials";

interface CraftingProgressProps {
  sessions: CraftingSession[];
  onCollect: (sessionId: string) => void;
  isCollecting: boolean;
}

export const CraftingProgress = ({ sessions, onCollect, isCollecting }: CraftingProgressProps) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeSessions = sessions.filter((s) => s.status === "in_progress" || s.status === "completed");
  const completedSessions = sessions.filter((s) => s.status === "collected");

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No active crafting sessions.</p>
        <p className="text-xs mt-1">Start crafting from the Blueprints tab!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Active Crafts
          </h3>
          <div className="space-y-2">
            {activeSessions.map((session) => {
              const startMs = new Date(session.started_at).getTime();
              const endMs = new Date(session.completes_at).getTime();
              const totalMs = endMs - startMs;
              const elapsedMs = now - startMs;
              const progress = Math.min(100, (elapsedMs / totalMs) * 100);
              const isReady = now >= endMs;
              const remainingMs = Math.max(0, endMs - now);
              const remainingMin = Math.ceil(remainingMs / 60000);

              return (
                <Card key={session.id} className="border-border/50">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{session.recipe?.name || "Crafting..."}</span>
                      {isReady ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30" variant="outline">
                          Ready!
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{remainingMin}min left</span>
                      )}
                    </div>
                    <Progress value={progress} className="h-2" />
                    {isReady && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => onCollect(session.id)}
                        disabled={isCollecting}
                      >
                        <Package className="w-3.5 h-3.5 mr-1" /> Collect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {completedSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Completed
          </h3>
          <div className="space-y-2">
            {completedSessions.slice(0, 10).map((session) => {
              const quality = session.quality_roll != null ? getQualityLabel(session.quality_roll) : null;
              return (
                <Card key={session.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm">{session.recipe?.name || "Item"}</span>
                    {quality && (
                      <Badge variant="outline" className={quality.color}>
                        {quality.label} ({Math.round(session.quality_roll!)}%)
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
