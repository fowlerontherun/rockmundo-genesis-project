// Reputation Card - Full display of all 4 reputation axes
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReputationAxisBar } from "./ReputationAxisBar";
import { usePlayerReputation } from "@/hooks/useReputation";
import { REPUTATION_AXES } from "@/types/roleplaying";
import { Shield } from "lucide-react";

interface ReputationCardProps {
  compact?: boolean;
  showTitle?: boolean;
}

export const ReputationCard = ({ compact = false, showTitle = true }: ReputationCardProps) => {
  const { data: reputation, isLoading, error } = usePlayerReputation();

  if (isLoading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Reputation
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !reputation) {
    return (
      <Card>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Reputation
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Complete onboarding to build your reputation
          </p>
        </CardContent>
      </Card>
    );
  }

  const scores = {
    authenticity: reputation.authenticity_score,
    attitude: reputation.attitude_score,
    reliability: reputation.reliability_score,
    creativity: reputation.creativity_score,
  };

  // Calculate overall "vibe" based on dominant traits
  const getOverallVibe = () => {
    const dominant = REPUTATION_AXES.reduce((max, axis) => {
      const absScore = Math.abs(scores[axis.key]);
      return absScore > Math.abs(scores[max.key]) ? axis : max;
    }, REPUTATION_AXES[0]);

    const score = scores[dominant.key];
    if (Math.abs(score) < 25) return { label: "Balanced", variant: "secondary" as const };
    return {
      label: score > 0 ? dominant.highLabel : dominant.lowLabel,
      variant: score > 0 ? "default" as const : "destructive" as const,
    };
  };

  const vibe = getOverallVibe();

  return (
    <Card>
      {showTitle && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Reputation
            </CardTitle>
            <Badge variant={vibe.variant}>{vibe.label}</Badge>
          </div>
        </CardHeader>
      )}
      <CardContent className={compact ? "space-y-3" : "space-y-4"}>
        {REPUTATION_AXES.map((axis) => (
          <ReputationAxisBar
            key={axis.key}
            axis={axis.key}
            score={scores[axis.key]}
            lowLabel={axis.lowLabel}
            highLabel={axis.highLabel}
            size={compact ? "sm" : "md"}
          />
        ))}
      </CardContent>
    </Card>
  );
};
