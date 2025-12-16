import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface AcceptanceChanceIndicatorProps {
  songQuality: number;
  stationQuality: number;
  genreMatches: boolean;
  bandFame: number;
}

export function AcceptanceChanceIndicator({
  songQuality,
  stationQuality,
  genreMatches,
  bandFame,
}: AcceptanceChanceIndicatorProps) {
  // Calculate acceptance chance based on factors
  let baseChance = 50;
  
  // Quality comparison (up to +/- 30%)
  const qualityDiff = songQuality - stationQuality;
  if (qualityDiff >= 20) baseChance += 30;
  else if (qualityDiff >= 10) baseChance += 20;
  else if (qualityDiff >= 0) baseChance += 10;
  else if (qualityDiff >= -10) baseChance -= 10;
  else if (qualityDiff >= -20) baseChance -= 20;
  else baseChance -= 30;
  
  // Genre match (+/- 20%)
  if (genreMatches) baseChance += 20;
  else baseChance -= 20;
  
  // Fame bonus (up to +20%)
  const fameBonus = Math.min(20, Math.floor(bandFame / 500));
  baseChance += fameBonus;
  
  // Clamp between 5% and 95%
  const chance = Math.max(5, Math.min(95, baseChance));
  
  const getChanceColor = () => {
    if (chance >= 70) return "text-emerald-500";
    if (chance >= 40) return "text-amber-500";
    return "text-destructive";
  };
  
  const getChanceIcon = () => {
    if (chance >= 70) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (chance >= 40) return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };
  
  const getChanceLabel = () => {
    if (chance >= 70) return "High";
    if (chance >= 40) return "Medium";
    return "Low";
  };

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Acceptance Chance</span>
        <div className="flex items-center gap-2">
          {getChanceIcon()}
          <span className={`font-bold ${getChanceColor()}`}>{chance}%</span>
          <Badge variant={chance >= 70 ? "default" : chance >= 40 ? "secondary" : "destructive"}>
            {getChanceLabel()}
          </Badge>
        </div>
      </div>
      <Progress value={chance} className="h-2" />
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>Quality:</span>
          <span className={qualityDiff >= 0 ? "text-emerald-500" : "text-amber-500"}>
            {songQuality} vs {stationQuality}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>Genre:</span>
          <span className={genreMatches ? "text-emerald-500" : "text-destructive"}>
            {genreMatches ? "Match" : "No Match"}
          </span>
        </div>
      </div>
    </div>
  );
}
