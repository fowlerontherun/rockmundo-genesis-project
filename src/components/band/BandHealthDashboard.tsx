import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Heart, Megaphone, Shield, Smile, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getFanSentiment } from "@/utils/fanSentiment";
import { getMediaCycleState } from "@/utils/mediaCycle";
import { getReputationState } from "@/utils/publicImageReputation";
import { getMoraleState } from "@/utils/bandMorale";
import { calculateFeedbackDeltas } from "@/utils/healthSystemFeedback";

interface BandHealthDashboardProps {
  sentimentScore: number;
  mediaIntensity: number;
  mediaFatigue: number;
  reputationScore: number;
  moraleScore: number;
}

interface HealthMetric {
  label: string;
  icon: React.ReactNode;
  value: string;
  score: number;       // normalized 0-100
  status: "critical" | "warning" | "neutral" | "good" | "excellent";
}

const STATUS_COLORS: Record<HealthMetric["status"], string> = {
  critical: "text-destructive",
  warning: "text-orange-400",
  neutral: "text-muted-foreground",
  good: "text-primary",
  excellent: "text-emerald-400",
};

const STATUS_BG: Record<HealthMetric["status"], string> = {
  critical: "bg-destructive/20 border-destructive/30",
  warning: "bg-orange-500/15 border-orange-500/25",
  neutral: "bg-muted/30 border-border",
  good: "bg-primary/15 border-primary/25",
  excellent: "bg-emerald-500/15 border-emerald-500/25",
};

function sentimentStatus(score: number): HealthMetric["status"] {
  if (score <= -60) return "critical";
  if (score <= -20) return "warning";
  if (score <= 20) return "neutral";
  if (score <= 60) return "good";
  return "excellent";
}

function mediaStatus(phase: string): HealthMetric["status"] {
  if (phase === "oversaturated") return "critical";
  if (phase === "declining") return "warning";
  if (phase === "dormant") return "neutral";
  if (phase === "building") return "good";
  return "excellent"; // peak
}

function reputationStatus(score: number): HealthMetric["status"] {
  if (score <= -60) return "critical";
  if (score <= -20) return "warning";
  if (score <= 20) return "neutral";
  if (score <= 60) return "good";
  return "excellent";
}

function moraleStatus(score: number): HealthMetric["status"] {
  if (score <= 20) return "critical";
  if (score <= 40) return "warning";
  if (score <= 60) return "neutral";
  if (score <= 80) return "good";
  return "excellent";
}

export const BandHealthDashboard = ({
  sentimentScore,
  mediaIntensity,
  mediaFatigue,
  reputationScore,
  moraleScore,
}: BandHealthDashboardProps) => {
  const sentiment = getFanSentiment(sentimentScore);
  const media = getMediaCycleState(mediaIntensity, mediaFatigue);
  const reputation = getReputationState(reputationScore);
  const morale = getMoraleState(moraleScore);

  const metrics: HealthMetric[] = [
    {
      label: "Fan Sentiment",
      icon: <Heart className="h-3.5 w-3.5" />,
      value: `${sentiment.mood.charAt(0).toUpperCase() + sentiment.mood.slice(1)} (${sentiment.score})`,
      score: ((sentiment.score + 100) / 200) * 100,
      status: sentimentStatus(sentiment.score),
    },
    {
      label: "Media Cycle",
      icon: <Megaphone className="h-3.5 w-3.5" />,
      value: `${media.phase.charAt(0).toUpperCase() + media.phase.slice(1)} (${media.coverageMultiplier}x)`,
      score: media.intensity,
      status: mediaStatus(media.phase),
    },
    {
      label: "Public Image",
      icon: <Shield className="h-3.5 w-3.5" />,
      value: reputation.label,
      score: ((reputation.score + 100) / 200) * 100,
      status: reputationStatus(reputation.score),
    },
    {
      label: "Band Morale",
      icon: <Smile className="h-3.5 w-3.5" />,
      value: `${morale.level.charAt(0).toUpperCase() + morale.level.slice(1)} (${morale.score})`,
      score: morale.score,
      status: moraleStatus(morale.score),
    },
  ];

  // Overall health: average of normalized scores
  const overallScore = Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
  const overallStatus = overallScore >= 75 ? "excellent" : overallScore >= 55 ? "good" : overallScore >= 35 ? "neutral" : overallScore >= 20 ? "warning" : "critical";

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Band Health
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 ml-auto ${STATUS_BG[overallStatus]} ${STATUS_COLORS[overallStatus]}`}
          >
            {overallScore}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={STATUS_COLORS[metric.status]}>{metric.icon}</span>
                  <span className="text-[10px] text-muted-foreground">{metric.label}</span>
                </div>
                <span className={`text-[10px] font-medium ${STATUS_COLORS[metric.status]}`}>
                  {metric.value}
                </span>
              </div>
              <Progress value={metric.score} className="h-1" />
            </div>
          ))}
        </div>

        {/* Alerts for critical/warning states */}
        {metrics.some(m => m.status === "critical") && (
          <div className="mt-2 p-1.5 rounded bg-destructive/10 border border-destructive/20">
            <p className="text-[9px] text-destructive font-medium">
              ⚠️ Critical: {metrics.filter(m => m.status === "critical").map(m => m.label).join(", ")} need attention
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
