// Reputation Summary - Compact widget for dashboard sidebar
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayerReputation, getReputationLabel, getReputationColor } from "@/hooks/useReputation";
import { REPUTATION_AXES, type ReputationAxis } from "@/types/roleplaying";
import { Heart, Smile, Clock, Lightbulb, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const AXIS_ICONS: Record<ReputationAxis, typeof Heart> = {
  authenticity: Heart,
  attitude: Smile,
  reliability: Clock,
  creativity: Lightbulb,
};

export const ReputationSummary = () => {
  const { data: reputation, isLoading } = usePlayerReputation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4" />
            <span className="font-semibold text-sm">Reputation</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reputation) {
    return null;
  }

  const scores = {
    authenticity: reputation.authenticity_score,
    attitude: reputation.attitude_score,
    reliability: reputation.reliability_score,
    creativity: reputation.creativity_score,
  };

  return (
    <Link to="/my-character">
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Reputation</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {REPUTATION_AXES.map((axis) => {
              const Icon = AXIS_ICONS[axis.key];
              const score = scores[axis.key];
              const { label, intensity } = getReputationLabel(axis.key, score);
              
              return (
                <div
                  key={axis.key}
                  className="flex items-center gap-1.5 p-1.5 rounded-md bg-muted/50"
                >
                  <Icon className={cn("h-3.5 w-3.5", getReputationColor(score))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">
                      {axis.name}
                    </p>
                    <p className={cn(
                      "text-xs font-medium truncate",
                      intensity === 'neutral' ? 'text-muted-foreground' : ''
                    )}>
                      {intensity === 'neutral' ? 'Neutral' : label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
