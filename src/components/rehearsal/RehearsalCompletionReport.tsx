import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Clock, TrendingUp, Award, Sparkles } from "lucide-react";
import {
  getRehearsalLevel,
  getNextLevelInfo,
  formatRehearsalTime,
  REHEARSAL_LEVELS,
} from "@/utils/rehearsalLevels";

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

export function RehearsalCompletionReport({
  open,
  onClose,
  results,
  chemistryGain,
  xpGained,
  durationHours,
}: RehearsalCompletionReportProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowDetails(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowDetails(false);
    }
  }, [open]);

  const getLevelBadgeVariant = (levelName: string) => {
    switch (levelName) {
      case "Perfected":
        return "default";
      case "Well Rehearsed":
        return "default";
      case "Familiar":
        return "secondary";
      case "Learning":
        return "outline";
      default:
        return "destructive";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Rehearsal Complete!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3 text-center">
                <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
                <div className="text-lg font-bold">{durationHours.toFixed(1)}h</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <div className="text-lg font-bold text-green-600">+{chemistryGain}</div>
                <div className="text-xs text-muted-foreground">Chemistry</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-3 text-center">
                <Award className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                <div className="text-lg font-bold text-amber-600">+{xpGained}</div>
                <div className="text-xs text-muted-foreground">XP</div>
              </CardContent>
            </Card>
          </div>

          {/* Song Progress */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Music className="h-4 w-4" />
              Song Familiarity Progress
            </h4>
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-3">
                {results.map((result) => {
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
                      className={`transition-all duration-500 ${
                        showDetails ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      } ${leveledUp ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate flex-1">
                            {result.songTitle}
                          </span>
                          <div className="flex items-center gap-2">
                            {leveledUp && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 animate-pulse">
                                LEVEL UP!
                              </Badge>
                            )}
                            <Badge variant={getLevelBadgeVariant(newLevel.name)}>
                              {newLevel.name}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            +{result.addedMinutes}m this session
                          </span>
                          <span>•</span>
                          <span>
                            Total: {formatRehearsalTime(result.newMinutes)}
                          </span>
                        </div>

                        {nextLevel ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Progress to {nextLevel.name}
                              </span>
                              <span className="font-medium">
                                {formatRehearsalTime(minutesNeeded)} remaining
                              </span>
                            </div>
                            <Progress value={progressPercent} className="h-1.5" />
                          </div>
                        ) : (
                          <div className="text-xs text-primary font-medium">
                            ✨ Maximum level reached!
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
