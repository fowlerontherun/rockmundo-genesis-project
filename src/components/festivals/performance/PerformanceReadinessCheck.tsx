import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertTriangle, Guitar, Music, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadinessItem {
  label: string;
  value: number;
  max: number;
  icon: React.ElementType;
  status: "ready" | "warning" | "critical";
  detail: string;
}

interface PerformanceReadinessCheckProps {
  songFamiliarity: number;
  bandChemistry: number;
  gearQuality: number;
  setlistCount: number;
}

export function PerformanceReadinessCheck({
  songFamiliarity,
  bandChemistry,
  gearQuality,
  setlistCount,
}: PerformanceReadinessCheckProps) {
  const getStatus = (value: number): "ready" | "warning" | "critical" => {
    if (value >= 70) return "ready";
    if (value >= 40) return "warning";
    return "critical";
  };

  const items: ReadinessItem[] = [
    {
      label: "Song Familiarity",
      value: songFamiliarity,
      max: 100,
      icon: Music,
      status: getStatus(songFamiliarity),
      detail: songFamiliarity >= 70 ? "Well rehearsed" : songFamiliarity >= 40 ? "Needs more practice" : "Barely know the songs",
    },
    {
      label: "Band Chemistry",
      value: bandChemistry,
      max: 100,
      icon: Users,
      status: getStatus(bandChemistry),
      detail: bandChemistry >= 70 ? "Tight unit" : bandChemistry >= 40 ? "Getting there" : "Disconnected",
    },
    {
      label: "Gear Quality",
      value: gearQuality,
      max: 100,
      icon: Guitar,
      status: getStatus(gearQuality),
      detail: gearQuality >= 70 ? "Top equipment" : gearQuality >= 40 ? "Decent gear" : "Basic setup",
    },
    {
      label: "Setlist Prepared",
      value: setlistCount > 0 ? 100 : 0,
      max: 100,
      icon: Wrench,
      status: setlistCount > 0 ? "ready" : "warning",
      detail: setlistCount > 0 ? `${setlistCount} songs ready` : "No setlist selected",
    },
  ];

  const overallReadiness = Math.round(
    items.reduce((acc, item) => acc + item.value, 0) / items.length
  );

  const statusIcons = {
    ready: CheckCircle,
    warning: AlertTriangle,
    critical: XCircle,
  };

  const statusColors = {
    ready: "text-green-500",
    warning: "text-yellow-500",
    critical: "text-red-500",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Performance Readiness
          </CardTitle>
          <Badge
            variant={overallReadiness >= 70 ? "default" : overallReadiness >= 40 ? "secondary" : "destructive"}
          >
            {overallReadiness}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const StatusIcon = statusIcons[item.status];
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4", statusColors[item.status])} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </div>
              <Progress value={item.value} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
