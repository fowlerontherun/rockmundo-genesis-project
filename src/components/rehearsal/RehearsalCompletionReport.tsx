import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Clock, TrendingUp, Award, Sparkles, Timer } from "lucide-react";
import {
  getRehearsalLevel,
  getNextLevelInfo,
  formatRehearsalTime,
  REHEARSAL_LEVELS,
} from "@/utils/rehearsalLevels";
import { cn } from "@/lib/utils";

export interface SongRehearsalResult {
  songId: string;
  songTitle: string;
  previousMinutes: number;
  addedMinutes: number;
  newMinutes: number;
}

interface RehearsalCompletionReportProps {
  open: boolean;
  onClose: () => void;
  results: SongRehearsalResult[];
  chemistryGain: number;
  xpGained: number;
  durationHours: number;
}

// Enhanced time formatting for remaining time
const formatTimeRemaining = (minutes: number): string => {
  if (minutes >= 120) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

// Get color class for progress bar based on level
const getProgressColorClass = (levelName: string): string => {
  switch (levelName) {
    case "Perfected":
      return "bg-purple-500";
    case "Well Rehearsed":
      return "bg-blue-500";
    case "Familiar":
      return "bg-green-500";
    case "Learning":
      return "bg-yellow-500";
    default:
      return "bg-muted-foreground";
  }
};

// Get badge styling based on level
const getLevelBadgeClass = (levelName: string): string => {
  switch (levelName) {
    case "Perfected":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "Well Rehearsed":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Familiar":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Learning":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function RehearsalCompletionReport({
  open,
  onClose,
  results,
  chemistryGain,
  xpGained,
  durationHours,
}: RehearsalCompletionReportProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate total minutes added across all songs
  const totalMinutesAdded = useMemo(() => 
    results.reduce((sum, r) => sum + r.addedMinutes, 0), 
    [results]
  );

  // Count level-ups
  const levelUpCount = useMemo(() => 
    results.filter(r => {
      const prevLevel = getRehearsalLevel(r.previousMinutes);
      const newLevel = getRehearsalLevel(r.newMinutes);
      return newLevel.level > prevLevel.level;
    }).length,
    [results]
  );

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowDetails(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowDetails(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            Rehearsal Complete!
            {levelUpCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] animate-bounce">
                {levelUpCount} LEVEL UP{levelUpCount > 1 ? 'S' : ''}!
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-2 text-center">
                <Clock className="h-3 w-3 mx-auto mb-1 text-primary" />
                <div className="text-sm font-bold">{durationHours.toFixed(1)}h</div>
                <div className="text-[10px] text-muted-foreground">Duration</div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-2 text-center">
                <TrendingUp className="h-3 w-3 mx-auto mb-1 text-green-500" />
                <div className="text-sm font-bold text-green-500">+{chemistryGain}</div>
                <div className="text-[10px] text-muted-foreground">Chemistry</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-2 text-center">
                <Award className="h-3 w-3 mx-auto mb-1 text-amber-500" />
                <div className="text-sm font-bold text-amber-500">+{xpGained}</div>
                <div className="text-[10px] text-muted-foreground">XP</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/5 border-purple-500/20">
              <CardContent className="p-2 text-center">
                <Timer className="h-3 w-3 mx-auto mb-1 text-purple-500" />
                <div className="text-sm font-bold text-purple-500">{formatRehearsalTime(totalMinutesAdded)}</div>
                <div className="text-[10px] text-muted-foreground">Practiced</div>
              </CardContent>
            </Card>
          </div>

          {/* Song Progress */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <Music className="h-4 w-4" />
              Song Familiarity Progress ({results.length} song{results.length !== 1 ? 's' : ''})
            </h4>
            <ScrollArea className="h-[260px] pr-4">
              <div className="space-y-2">
                {results.map((result, index) => {
                  const previousLevel = getRehearsalLevel(result.previousMinutes);
                  const newLevel = getRehearsalLevel(result.newMinutes);
                  const { nextLevel, minutesNeeded } = getNextLevelInfo(result.newMinutes);
                  const leveledUp = newLevel.level > previousLevel.level;

                  // Calculate progress to next level
                  let progressPercent = 100;
                  if (nextLevel) {
                    const currentLevelMin = REHEARSAL_LEVELS[newLevel.level]?.minMinutes || 0;
                    const nextLevelMin = nextLevel.minMinutes;
                    const rangeTotal = nextLevelMin - currentLevelMin;
                    const progressInRange = result.newMinutes - currentLevelMin;
                    progressPercent = Math.min(100, (progressInRange / rangeTotal) * 100);
                  }

                  return (
                    <Card
                      key={result.songId}
                      className={cn(
                        "transition-all duration-500",
                        showDetails ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                        leveledUp && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                      style={{ transitionDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate flex-1">
                            {result.songTitle}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {leveledUp && (
                              <Badge className="bg-primary text-primary-foreground text-[9px] px-1 py-0 animate-pulse">
                                ⬆ UP!
                              </Badge>
                            )}
                            <Badge className={cn("text-[10px] px-1.5 py-0", getLevelBadgeClass(newLevel.name))}>
                              {newLevel.name}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="text-green-500 font-medium">
                            +{formatRehearsalTime(result.addedMinutes)}
                          </span>
                          <span>•</span>
                          <span>
                            Total: {formatRehearsalTime(result.newMinutes)}
                          </span>
                        </div>

                        {nextLevel ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">
                                → {nextLevel.name}
                              </span>
                              <span className="font-medium">
                                {formatTimeRemaining(minutesNeeded)} left
                              </span>
                            </div>
                            {/* Custom color-coded progress bar */}
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-700 ease-out",
                                  getProgressColorClass(newLevel.name)
                                )}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-purple-400 font-medium flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Maximum level reached!
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Summary Footer */}
          <div className="text-center text-xs text-muted-foreground pt-2 border-t">
            <span>
              Practiced {results.length} song{results.length !== 1 ? 's' : ''} for a total of {formatRehearsalTime(totalMinutesAdded)}
              {levelUpCount > 0 && <span className="text-primary"> • {levelUpCount} level-up{levelUpCount !== 1 ? 's' : ''}!</span>}
            </span>
          </div>

          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
