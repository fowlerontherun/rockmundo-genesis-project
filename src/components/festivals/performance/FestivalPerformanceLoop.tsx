import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Play, Pause, SkipForward, Music, Mic, Zap, 
  AlertTriangle, CheckCircle, XCircle, Users, Volume2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CrowdEnergyMeter } from "./CrowdEnergyMeter";
import { PerformanceScoreBreakdown } from "./PerformanceScoreBreakdown";
import { useFestivalPerformance, type PerformanceEvent } from "@/hooks/useFestivalPerformance";

interface FestivalPerformanceLoopProps {
  participationId: string;
  bandId?: string;
  festivalTitle: string;
  slotType: string;
  onComplete?: () => void;
}

export function FestivalPerformanceLoop({
  participationId,
  bandId,
  festivalTitle,
  slotType,
  onComplete,
}: FestivalPerformanceLoopProps) {
  const {
    phases,
    currentPhase,
    currentPhaseData,
    crowdEnergy,
    crowdEnergyHistory,
    isPerforming,
    pendingEvent,
    startPerformance,
    advancePhase,
    handleEventResponse,
    adjustCrowdEnergy,
    completePerformance,
    isCompleting,
    performanceResult,
  } = useFestivalPerformance(participationId, bandId);

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [phaseTimer, setPhaseTimer] = useState(0);

  // Show event dialog when pending event appears
  useEffect(() => {
    if (pendingEvent) {
      setShowEventDialog(true);
    }
  }, [pendingEvent]);

  // Show result dialog when performance completes
  useEffect(() => {
    if (performanceResult) {
      setShowResultDialog(true);
    }
  }, [performanceResult]);

  // Phase timer simulation
  useEffect(() => {
    if (!isPerforming || !currentPhaseData) return;

    const interval = setInterval(() => {
      setPhaseTimer((prev) => {
        const next = prev + 1;
        if (next >= currentPhaseData.duration) {
          if (currentPhase < phases.length - 1) {
            advancePhase();
            return 0;
          } else {
            // Complete performance on last phase
            completePerformance.mutate();
            return prev;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPerforming, currentPhaseData, currentPhase, phases.length, advancePhase, completePerformance]);

  const getPhaseIcon = (type: string) => {
    switch (type) {
      case "soundcheck": return Volume2;
      case "opening": return Music;
      case "main_set": return Mic;
      case "crowd_interaction": return Users;
      case "climax": return Zap;
      default: return Music;
    }
  };

  const handleEventChoice = (score: number) => {
    handleEventResponse(score);
    setShowEventDialog(false);
  };

  if (!isPerforming && !performanceResult) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Music className="h-6 w-6" />
            Festival Performance
          </CardTitle>
          <CardDescription>
            {festivalTitle} - {slotType} Slot
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Ready to perform? This interactive minigame will determine your festival score based on:
          </p>
          <ul className="text-sm text-left max-w-xs mx-auto space-y-1">
            <li>• Song familiarity from rehearsals</li>
            <li>• Band chemistry level</li>
            <li>• Equipment quality</li>
            <li>• Crowd energy management</li>
            <li>• Random event responses</li>
          </ul>
          <Button size="lg" onClick={startPerformance} className="mt-4">
            <Play className="h-5 w-5 mr-2" />
            Start Performance
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (performanceResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <PerformanceScoreBreakdown result={performanceResult} />
        <div className="mt-4 text-center">
          <Button onClick={onComplete}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Phase Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            {phases.map((phase, idx) => {
              const Icon = getPhaseIcon(phase.type);
              const isActive = idx === currentPhase;
              const isComplete = idx < currentPhase;

              return (
                <div key={phase.id} className="flex items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      isActive && "bg-primary text-primary-foreground scale-110",
                      isComplete && "bg-green-500 text-white",
                      !isActive && !isComplete && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isComplete ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  {idx < phases.length - 1 && (
                    <div className={cn("w-8 h-0.5 mx-1", isComplete ? "bg-green-500" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>

          {currentPhaseData && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold">{currentPhaseData.name}</h3>
                  <p className="text-sm text-muted-foreground">{currentPhaseData.description}</p>
                </div>
                <Badge variant="secondary">
                  {phaseTimer}s / {currentPhaseData.duration}s
                </Badge>
              </div>
              <Progress value={(phaseTimer / currentPhaseData.duration) * 100} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crowd Energy */}
      <CrowdEnergyMeter energy={crowdEnergy} history={crowdEnergyHistory} />

      {/* Stage Movement & Crowd Interaction */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stage Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => adjustCrowdEnergy(12)} className="text-green-500">
              <Zap className="h-4 w-4 mr-2" />
              Jump & Hype!
            </Button>
            <Button variant="outline" onClick={() => adjustCrowdEnergy(8)} className="text-blue-500">
              <Users className="h-4 w-4 mr-2" />
              Engage Fans
            </Button>
            <Button variant="outline" onClick={() => adjustCrowdEnergy(6)} className="text-purple-500">
              <Mic className="h-4 w-4 mr-2" />
              Stage Dive
            </Button>
            <Button variant="outline" onClick={() => adjustCrowdEnergy(-3)} className="text-yellow-500">
              <Pause className="h-4 w-4 mr-2" />
              Build Tension
            </Button>
          </div>
          <Button variant="secondary" onClick={() => advancePhase()} disabled={currentPhase >= phases.length - 1} className="w-full">
            <SkipForward className="h-4 w-4 mr-2" />
            Next Phase
          </Button>
        </CardContent>
      </Card>

      {/* Complete Button */}
      {currentPhase >= phases.length - 1 && phaseTimer > 10 && (
        <Button 
          className="w-full" 
          size="lg" 
          onClick={() => completePerformance.mutate()}
          disabled={isCompleting}
        >
          {isCompleting ? "Calculating Score..." : "Finish Performance"}
        </Button>
      )}

      {/* Random Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              Random Event!
            </DialogTitle>
            <DialogDescription>
              {pendingEvent?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 mt-4">
            {pendingEvent?.options.map((option, idx) => (
              <Button
                key={idx}
                variant={option.score >= 80 ? "default" : option.score >= 50 ? "secondary" : "outline"}
                className="justify-start h-auto py-3"
                onClick={() => handleEventChoice(option.score)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Performance Complete!</DialogTitle>
          </DialogHeader>
          {performanceResult && <PerformanceScoreBreakdown result={performanceResult} />}
          <Button onClick={() => { setShowResultDialog(false); onComplete?.(); }} className="mt-4">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
